import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { SupportAuthService } from './support-auth.service';
import { RegisterSupportUserDto, LoginSupportUserDto } from './dto/support-user.dto';
import { SupportJwtAuthGuard } from './guards/support-jwt.guard';

@Controller('support/auth')
export class SupportAuthController {
  constructor(private supportAuthService: SupportAuthService) {}

  @Post('register')
  register(@Body() dto: RegisterSupportUserDto) {
    return this.supportAuthService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginSupportUserDto) {
    return this.supportAuthService.login(dto);
  }

  @Get('profile')
  @UseGuards(SupportJwtAuthGuard)
  getProfile(@Request() req) {
    return this.supportAuthService.getProfile(req.user.userId);
  }
}
