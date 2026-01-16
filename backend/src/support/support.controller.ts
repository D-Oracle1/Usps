import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportGateway } from './support.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SupportJwtAuthGuard } from './guards/support-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { SenderType, ConversationStatus } from '@prisma/client';

@Controller('support')
export class SupportController {
  private readonly logger = new Logger(SupportController.name);

  constructor(
    private supportService: SupportService,
    private supportGateway: SupportGateway,
  ) {}

  /**
   * Safely parse pagination parameters with validation
   */
  private parsePagination(
    pageStr?: string,
    limitStr?: string,
    defaultLimit: number = 50,
  ): { page: number; limit: number } {
    let page = 1;
    let limit = defaultLimit;

    if (pageStr !== undefined && pageStr !== null && pageStr !== '') {
      const parsed = parseInt(pageStr, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new BadRequestException(
          `Invalid page parameter: "${pageStr}". Must be a positive integer.`,
        );
      }
      page = parsed;
    }

    if (limitStr !== undefined && limitStr !== null && limitStr !== '') {
      const parsed = parseInt(limitStr, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        throw new BadRequestException(
          `Invalid limit parameter: "${limitStr}". Must be between 1 and 100.`,
        );
      }
      limit = parsed;
    }

    return { page, limit };
  }

  /**
   * Validate that req.user exists for support user auth
   */
  private validateSupportUserAuth(req: any, context: string): string {
    if (!req?.user) {
      this.logger.warn(`Unauthenticated support user request to ${context}`);
      throw new UnauthorizedException('Authentication required');
    }
    const userId = req.user.userId || req.user.sub;
    if (!userId) {
      this.logger.warn(`Invalid support user token in ${context}: missing userId`);
      throw new UnauthorizedException('Invalid authentication token');
    }
    return userId;
  }

  /**
   * Validate that req.user exists for admin auth
   */
  private validateAdminAuth(req: any, context: string): string {
    if (!req?.user) {
      this.logger.warn(`Unauthenticated admin request to ${context}`);
      throw new UnauthorizedException('Authentication required');
    }
    const userId = req.user.userId || req.user.sub;
    if (!userId) {
      this.logger.warn(`Invalid admin token in ${context}: missing userId`);
      throw new UnauthorizedException('Invalid authentication token');
    }
    return userId;
  }

  /**
   * Validate conversation ID parameter
   */
  private validateConversationId(id: string): void {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Conversation ID is required');
    }
  }

  /**
   * Validate message content
   */
  private validateMessageContent(content: any): string {
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new BadRequestException('Message content is required and must be a non-empty string');
    }
    return content.trim();
  }

  // ============ User Endpoints (Support User Auth) ============

  @Post('conversations')
  @UseGuards(SupportJwtAuthGuard)
  async createConversation(@Request() req, @Body() dto: CreateConversationDto) {
    const userId = this.validateSupportUserAuth(req, 'POST /support/conversations');
    this.logger.log(`Creating conversation for user ${userId}`);

    try {
      const result = await this.supportService.createConversation(userId, dto);
      this.logger.log(`Conversation created: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create conversation: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('conversations')
  @UseGuards(SupportJwtAuthGuard)
  async getUserConversations(@Request() req) {
    const userId = this.validateSupportUserAuth(req, 'GET /support/conversations');
    this.logger.log(`Fetching conversations for user ${userId}`);

    try {
      const result = await this.supportService.getUserConversations(userId);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch user conversations: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('conversations/:id')
  @UseGuards(SupportJwtAuthGuard)
  async getConversation(@Param('id') id: string) {
    this.validateConversationId(id);
    this.logger.log(`Fetching conversation ${id}`);

    try {
      const result = await this.supportService.getConversationById(id);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch conversation ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('conversations/:id/messages')
  @UseGuards(SupportJwtAuthGuard)
  async getMessages(
    @Param('id') id: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    this.validateConversationId(id);
    const { page, limit } = this.parsePagination(pageStr, limitStr);
    this.logger.log(`Fetching messages for conversation ${id}: page=${page}, limit=${limit}`);

    try {
      const result = await this.supportService.getConversationMessages(id, page, limit);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch messages for ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('conversations/:id/messages')
  @UseGuards(SupportJwtAuthGuard)
  async sendMessage(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() body: { content: string },
  ) {
    const userId = this.validateSupportUserAuth(req, `POST /support/conversations/${conversationId}/messages`);
    this.validateConversationId(conversationId);
    const content = this.validateMessageContent(body?.content);

    this.logger.log(`User ${userId} sending message to conversation ${conversationId}`);

    try {
      const message = await this.supportService.createMessage(
        { conversationId, content },
        userId,
        SenderType.USER,
      );

      // Emit via WebSocket for real-time updates (if server is available)
      if (this.supportGateway?.server) {
        this.supportGateway.server.to(`conversation:${conversationId}`).emit('newMessage', {
          ...message,
          conversationId,
        });
        this.supportGateway.server.to('admin-room').emit('conversationUpdated', {
          conversationId,
          lastMessage: message,
        });
      }

      this.logger.log(`Message sent: ${message.id}`);
      return message;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('conversations/:id/read')
  @UseGuards(SupportJwtAuthGuard)
  async markAsRead(@Request() req, @Param('id') id: string) {
    const userId = this.validateSupportUserAuth(req, `POST /support/conversations/${id}/read`);
    this.validateConversationId(id);

    try {
      const result = await this.supportService.markMessagesAsRead(id, userId, 'support_user');
      return result;
    } catch (error) {
      this.logger.error(`Failed to mark messages as read: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to mark messages as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ Admin Endpoints (Admin Auth) ============

  @Get('admin/conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async getAllConversations(
    @Request() req,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const userId = this.validateAdminAuth(req, 'GET /support/admin/conversations');
    this.logger.log(`Admin ${userId} fetching all conversations, status=${status}, search=${search}`);

    try {
      const result = await this.supportService.getAllConversations({ status, search });
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch all conversations: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin/conversations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async getAdminConversation(@Request() req, @Param('id') id: string) {
    this.validateAdminAuth(req, `GET /support/admin/conversations/${id}`);
    this.validateConversationId(id);

    try {
      const result = await this.supportService.getConversationById(id);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch conversation ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin/conversations/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async getAdminMessages(
    @Request() req,
    @Param('id') id: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    this.validateAdminAuth(req, `GET /support/admin/conversations/${id}/messages`);
    this.validateConversationId(id);
    const { page, limit } = this.parsePagination(pageStr, limitStr);

    this.logger.log(`Fetching admin messages for ${id}: page=${page}, limit=${limit}`);

    try {
      const result = await this.supportService.getConversationMessages(id, page, limit);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch messages for ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('admin/conversations/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async sendAdminMessage(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() body: { content: string },
  ) {
    const userId = this.validateAdminAuth(req, `POST /support/admin/conversations/${conversationId}/messages`);
    this.validateConversationId(conversationId);
    const content = this.validateMessageContent(body?.content);

    this.logger.log(`Admin ${userId} sending message to conversation ${conversationId}`);

    try {
      const message = await this.supportService.createMessage(
        { conversationId, content },
        userId,
        SenderType.ADMIN,
      );

      // Emit via WebSocket for real-time updates
      if (this.supportGateway?.server) {
        this.supportGateway.server.to(`conversation:${conversationId}`).emit('newMessage', {
          ...message,
          conversationId,
        });
      }

      this.logger.log(`Admin message sent: ${message.id}`);
      return message;
    } catch (error) {
      this.logger.error(`Failed to send admin message: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('admin/conversations/:id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async adminMarkAsRead(@Request() req, @Param('id') id: string) {
    const userId = this.validateAdminAuth(req, `POST /support/admin/conversations/${id}/read`);
    this.validateConversationId(id);

    try {
      const result = await this.supportService.markMessagesAsRead(id, userId, 'admin');
      return result;
    } catch (error) {
      this.logger.error(`Failed to mark messages as read: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to mark messages as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('admin/conversations/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async assignConversation(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { adminId: string },
  ) {
    this.validateAdminAuth(req, `PATCH /support/admin/conversations/${id}/assign`);
    this.validateConversationId(id);

    if (!body?.adminId || typeof body.adminId !== 'string') {
      throw new BadRequestException('adminId is required');
    }

    this.logger.log(`Assigning conversation ${id} to admin ${body.adminId}`);

    try {
      const result = await this.supportService.assignConversation(id, body.adminId);
      return result;
    } catch (error) {
      this.logger.error(`Failed to assign conversation: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to assign conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('admin/conversations/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { status: ConversationStatus },
  ) {
    this.validateAdminAuth(req, `PATCH /support/admin/conversations/${id}/status`);
    this.validateConversationId(id);

    if (!body?.status) {
      throw new BadRequestException('status is required');
    }

    const validStatuses = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    this.logger.log(`Updating conversation ${id} status to ${body.status}`);

    try {
      const result = await this.supportService.updateConversationStatus(id, body.status);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update status: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update conversation status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin/statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async getStatistics(@Request() req) {
    this.validateAdminAuth(req, 'GET /support/admin/statistics');

    try {
      const result = await this.supportService.getChatStatistics();
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch statistics: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
