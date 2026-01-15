import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SupportService } from './support.service';
import { SenderType } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/support',
})
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track connected users: Map<socketId, { userId, userType }>
  private connectedUsers = new Map<string, { socketId: string; userId: string; userType: string }>();
  // Track typing timeouts
  private typingTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private supportService: SupportService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userType = payload.type || 'admin'; // 'support_user' or 'admin'

      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        type: userType,
      };

      // Track connected user
      this.connectedUsers.set(client.id, {
        socketId: client.id,
        userId: payload.sub,
        userType,
      });

      // Update online status for support users
      if (userType === 'support_user') {
        await this.supportService.updateOnlineStatus(payload.sub, true);
        this.server.emit('userOnline', { userId: payload.sub });
      }

      // Join admin room for admins to receive all conversation updates
      if (userType === 'admin') {
        client.join('admin-room');
      }

      client.emit('connected', { userId: payload.sub, userType });
    } catch (error) {
      console.error('WebSocket connection error:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userData = this.connectedUsers.get(client.id);

    if (userData) {
      this.connectedUsers.delete(client.id);

      if (userData.userType === 'support_user') {
        await this.supportService.updateOnlineStatus(userData.userId, false);
        this.server.emit('userOffline', { userId: userData.userId });
      }
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation:${data.conversationId}`;
    client.join(room);
    client.emit('joinedConversation', { conversationId: data.conversationId });
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation:${data.conversationId}`;
    client.leave(room);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { userId, type } = client.data.user;
      const senderType = type === 'support_user' ? SenderType.USER : SenderType.ADMIN;

      // Create message in database
      const message = await this.supportService.createMessage(
        { conversationId: data.conversationId, content: data.content },
        userId,
        senderType,
      );

      // Broadcast to conversation room
      const room = `conversation:${data.conversationId}`;
      this.server.to(room).emit('newMessage', {
        ...message,
        conversationId: data.conversationId,
      });

      // Notify admin room of new message for conversation list update
      this.server.to('admin-room').emit('conversationUpdated', {
        conversationId: data.conversationId,
        lastMessage: message,
      });

      return { success: true, message };
    } catch (error) {
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, type } = client.data.user;
    const room = `conversation:${data.conversationId}`;
    const key = `${data.conversationId}:${userId}`;

    // Broadcast typing status to others in the room
    client.to(room).emit('userTyping', {
      conversationId: data.conversationId,
      userId,
      userType: type,
      isTyping: data.isTyping,
    });

    // Auto-clear typing after 3 seconds
    if (data.isTyping) {
      // Clear existing timeout
      const existingTimeout = this.typingTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeout = setTimeout(() => {
        client.to(room).emit('userTyping', {
          conversationId: data.conversationId,
          userId,
          userType: type,
          isTyping: false,
        });
        this.typingTimeouts.delete(key);
      }, 3000);

      this.typingTimeouts.set(key, timeout);
    } else {
      // Clear timeout if user stopped typing
      const existingTimeout = this.typingTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.typingTimeouts.delete(key);
      }
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { userId, type } = client.data.user;

      await this.supportService.markMessagesAsRead(
        data.conversationId,
        userId,
        type,
      );

      // Broadcast read status to conversation room
      const room = `conversation:${data.conversationId}`;
      this.server.to(room).emit('messagesRead', {
        conversationId: data.conversationId,
        readBy: userId,
        readByType: type,
        readAt: new Date(),
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to mark as read' });
    }
  }

  // Helper method to get online status
  isUserOnline(userId: string): boolean {
    for (const [, userData] of this.connectedUsers) {
      if (userData.userId === userId) {
        return true;
      }
    }
    return false;
  }

  // Helper to emit to specific user
  emitToUser(userId: string, event: string, data: any) {
    for (const [socketId, userData] of this.connectedUsers) {
      if (userData.userId === userId) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
