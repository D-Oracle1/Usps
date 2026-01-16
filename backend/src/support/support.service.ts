import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SenderType, ConversationStatus } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // ============ Conversation Operations ============

  async createConversation(userId: string, dto: CreateConversationDto) {
    const conversation = await this.prisma.conversation.create({
      data: {
        supportUserId: userId,
        trackingNumber: dto.trackingNumber,
        subject: dto.subject,
        lastMessageAt: new Date(),
        messages: {
          create: {
            senderId: userId,
            senderType: SenderType.USER,
            content: dto.initialMessage,
          },
        },
      },
      include: {
        messages: true,
        supportUser: {
          select: { id: true, name: true, email: true, isOnline: true },
        },
      },
    });

    return conversation;
  }

  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { supportUserId: userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        assignedAdmin: {
          select: { id: true, name: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getAllConversations(filters?: { status?: string; search?: string }) {
    const where: any = {};

    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { supportUser: { name: { contains: filters.search, mode: 'insensitive' } } },
        { supportUser: { email: { contains: filters.search, mode: 'insensitive' } } },
        { trackingNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.conversation.findMany({
      where,
      include: {
        supportUser: {
          select: { id: true, name: true, email: true, isOnline: true, lastSeenAt: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        assignedAdmin: {
          select: { id: true, name: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getConversationById(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        supportUser: {
          select: { id: true, name: true, email: true, isOnline: true },
        },
        assignedAdmin: {
          select: { id: true, name: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async getConversationMessages(conversationId: string, page: number = 1, limit: number = 50) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.message.count({
      where: { conversationId },
    });

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============ Message Operations ============

  async createMessage(dto: CreateMessageDto, senderId: string, senderType: SenderType) {
    // Use raw query to bypass foreign key constraint for admin messages
    const messageId = randomUUID();
    const now = new Date();
    const messageType = dto.messageType || 'TEXT';

    // Cast enum values as strings - Prisma will handle the enum conversion
    const senderTypeStr = senderType.toString();
    const messageTypeStr = messageType.toString();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, is_read, created_at)
       VALUES ($1, $2, $3, $4::"SenderType", $5, $6::"MessageType", false, $7)`,
      messageId,
      dto.conversationId,
      senderId,
      senderTypeStr,
      dto.content,
      messageTypeStr,
      now
    );

    // Update conversation lastMessageAt
    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: now },
    });

    // Return the created message
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    return message;
  }

  async markMessagesAsRead(conversationId: string, userId: string, userType: string) {
    const oppositeType = userType === 'support_user' ? SenderType.ADMIN : SenderType.USER;

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderType: oppositeType,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  async getUnreadCount(conversationId: string, userType: string) {
    const senderType = userType === 'support_user' ? SenderType.ADMIN : SenderType.USER;

    return this.prisma.message.count({
      where: {
        conversationId,
        senderType,
        isRead: false,
      },
    });
  }

  // ============ Online Status ============

  async updateOnlineStatus(userId: string, isOnline: boolean) {
    await this.prisma.supportUser.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeenAt: new Date(),
      },
    });
  }

  // ============ Admin Operations ============

  async assignConversation(conversationId: string, adminId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedAdminId: adminId },
      include: {
        supportUser: {
          select: { id: true, name: true, email: true },
        },
        assignedAdmin: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async updateConversationStatus(conversationId: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  // ============ Statistics ============

  async getChatStatistics() {
    const [total, open, pending, resolved, closed] = await Promise.all([
      this.prisma.conversation.count(),
      this.prisma.conversation.count({ where: { status: ConversationStatus.OPEN } }),
      this.prisma.conversation.count({ where: { status: ConversationStatus.PENDING } }),
      this.prisma.conversation.count({ where: { status: ConversationStatus.RESOLVED } }),
      this.prisma.conversation.count({ where: { status: ConversationStatus.CLOSED } }),
    ]);

    const unreadMessages = await this.prisma.message.count({
      where: {
        isRead: false,
        senderType: SenderType.USER,
      },
    });

    return {
      total,
      open,
      pending,
      resolved,
      closed,
      unreadMessages,
    };
  }
}
