import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SenderType, ConversationStatus } from '@prisma/client';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private prisma: PrismaService) {}

  // ============ Conversation Operations ============

  async createConversation(userId: string, dto: CreateConversationDto) {
    this.logger.log(`Creating conversation for user ${userId}`);

    const conversation = await this.prisma.conversation.create({
      data: {
        supportUserId: userId,
        trackingNumber: dto.trackingNumber || null,
        subject: dto.subject || 'Support Request',
        lastMessageAt: new Date(),
        messages: {
          create: {
            senderId: userId,
            senderType: SenderType.USER,
            content: dto.initialMessage || '',
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
    this.logger.log(`Fetching conversations for user ${userId}`);

    const conversations = await this.prisma.conversation.findMany({
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

    return conversations || [];
  }

  async getAllConversations(filters?: { status?: string; search?: string }) {
    this.logger.log(`Fetching all conversations with filters: ${JSON.stringify(filters)}`);

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

    const conversations = await this.prisma.conversation.findMany({
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

    return conversations || [];
  }

  async getConversationById(conversationId: string) {
    this.logger.log(`Fetching conversation ${conversationId}`);

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
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    return conversation;
  }

  async getConversationMessages(conversationId: string, page: number = 1, limit: number = 50) {
    // Ensure page and limit are valid numbers
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 50));
    const skip = (safePage - 1) * safeLimit;

    this.logger.log(`Fetching messages for ${conversationId}: page=${safePage}, limit=${safeLimit}, skip=${skip}`);

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.message.count({
        where: { conversationId },
      }),
    ]);

    const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;

    return {
      messages: messages || [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  // ============ Message Operations ============

  async createMessage(dto: CreateMessageDto, senderId: string, senderType: SenderType) {
    this.logger.log(`Creating message in conversation ${dto.conversationId} from ${senderType} ${senderId}`);

    const now = new Date();
    const messageType = dto.messageType || 'TEXT';

    // Verify conversation exists first
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    // Use Prisma's create method for proper enum handling
    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId: senderId,
        senderType: senderType,
        content: dto.content || '',
        messageType: messageType as any,
        isRead: false,
        createdAt: now,
      },
    });

    // Update conversation lastMessageAt
    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: now },
    });

    this.logger.log(`Message created: ${message.id}`);
    return message;
  }

  async markMessagesAsRead(conversationId: string, userId: string, userType: string) {
    this.logger.log(`Marking messages as read in ${conversationId} for ${userType} ${userId}`);

    const oppositeType = userType === 'support_user' ? SenderType.ADMIN : SenderType.USER;

    const result = await this.prisma.message.updateMany({
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

    this.logger.log(`Marked ${result.count} messages as read`);
    return { success: true, count: result.count };
  }

  async getUnreadCount(conversationId: string, userType: string) {
    const senderType = userType === 'support_user' ? SenderType.ADMIN : SenderType.USER;

    const count = await this.prisma.message.count({
      where: {
        conversationId,
        senderType,
        isRead: false,
      },
    });

    return count;
  }

  // ============ Online Status ============

  async updateOnlineStatus(userId: string, isOnline: boolean) {
    this.logger.log(`Updating online status for user ${userId}: ${isOnline}`);

    try {
      await this.prisma.supportUser.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeenAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to update online status for ${userId}: ${error.message}`);
      // Don't throw - this is not critical
    }
  }

  // ============ Admin Operations ============

  async assignConversation(conversationId: string, adminId: string) {
    this.logger.log(`Assigning conversation ${conversationId} to admin ${adminId}`);

    const conversation = await this.prisma.conversation.update({
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

    return conversation;
  }

  async updateConversationStatus(conversationId: string, status: ConversationStatus) {
    this.logger.log(`Updating conversation ${conversationId} status to ${status}`);

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    return conversation;
  }

  // ============ Statistics ============

  async getChatStatistics() {
    this.logger.log('Fetching chat statistics');

    // Retry logic for database connection issues
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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
      } catch (error) {
        lastError = error;
        this.logger.warn(`Statistics fetch attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    // If all retries failed, return cached/default values to prevent UI errors
    this.logger.error(`All ${maxRetries} attempts failed for statistics. Returning defaults.`);
    return {
      total: 0,
      open: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
      unreadMessages: 0,
    };
  }
}
