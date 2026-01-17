import { Controller, Post, Get, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { SupportAuthService } from './support-auth.service';
import { RegisterSupportUserDto, LoginSupportUserDto } from './dto/support-user.dto';
import { SupportJwtAuthGuard } from './guards/support-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  @Post('link-account')
  @UseGuards(JwtAuthGuard)
  async linkAccount(@Request() req) {
    // User is authenticated via main JWT
    const email = req.user.email;
    const name = req.user.name || email.split('@')[0];

    if (!email) {
      throw new UnauthorizedException('Email not found in token');
    }

    return this.supportAuthService.linkFromMainAuth(email, name);
  }

  @Post('auto-create')
  @UseGuards(JwtAuthGuard)
  async autoCreate(@Request() req) {
    // User is authenticated via main JWT - auto-create support account
    const email = req.user.email;
    const name = req.user.name || email.split('@')[0];

    if (!email) {
      throw new UnauthorizedException('Email not found in token');
    }

    return this.supportAuthService.autoCreateFromMainAuth(email, name);
  }
}
