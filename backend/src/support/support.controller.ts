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
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SupportJwtAuthGuard } from './guards/support-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SenderType, ConversationStatus } from '@prisma/client';

@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  // ============ User Endpoints (Support User Auth) ============

  @Post('conversations')
  @UseGuards(SupportJwtAuthGuard)
  createConversation(@Request() req, @Body() dto: CreateConversationDto) {
    return this.supportService.createConversation(req.user.userId, dto);
  }

  @Get('conversations')
  @UseGuards(SupportJwtAuthGuard)
  getUserConversations(@Request() req) {
    return this.supportService.getUserConversations(req.user.userId);
  }

  @Get('conversations/:id')
  @UseGuards(SupportJwtAuthGuard)
  getConversation(@Param('id') id: string) {
    return this.supportService.getConversationById(id);
  }

  @Get('conversations/:id/messages')
  @UseGuards(SupportJwtAuthGuard)
  getMessages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getConversationMessages(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post('conversations/:id/messages')
  @UseGuards(SupportJwtAuthGuard)
  sendMessage(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() body: { content: string },
  ) {
    return this.supportService.createMessage(
      { conversationId, content: body.content },
      req.user.userId,
      SenderType.USER,
    );
  }

  @Post('conversations/:id/read')
  @UseGuards(SupportJwtAuthGuard)
  markAsRead(@Request() req, @Param('id') id: string) {
    return this.supportService.markMessagesAsRead(id, req.user.userId, 'support_user');
  }

  // ============ Admin Endpoints (Admin Auth) ============

  @Get('admin/conversations')
  @UseGuards(JwtAuthGuard)
  getAllConversations(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.supportService.getAllConversations({ status, search });
  }

  @Get('admin/conversations/:id')
  @UseGuards(JwtAuthGuard)
  getAdminConversation(@Param('id') id: string) {
    return this.supportService.getConversationById(id);
  }

  @Get('admin/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  getAdminMessages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getConversationMessages(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post('admin/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  sendAdminMessage(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() body: { content: string },
  ) {
    return this.supportService.createMessage(
      { conversationId, content: body.content },
      req.user.userId,
      SenderType.ADMIN,
    );
  }

  @Post('admin/conversations/:id/read')
  @UseGuards(JwtAuthGuard)
  adminMarkAsRead(@Request() req, @Param('id') id: string) {
    return this.supportService.markMessagesAsRead(id, req.user.userId, 'admin');
  }

  @Patch('admin/conversations/:id/assign')
  @UseGuards(JwtAuthGuard)
  assignConversation(
    @Param('id') id: string,
    @Body() body: { adminId: string },
  ) {
    return this.supportService.assignConversation(id, body.adminId);
  }

  @Patch('admin/conversations/:id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ConversationStatus },
  ) {
    return this.supportService.updateConversationStatus(id, body.status);
  }

  @Get('admin/statistics')
  @UseGuards(JwtAuthGuard)
  getStatistics() {
    return this.supportService.getChatStatistics();
  }
}
