import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAdminDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard, Roles } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.register(createAdminDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  // Development endpoint to upgrade current user to admin
  @Patch('make-admin')
  @UseGuards(JwtAuthGuard)
  async makeAdmin(@Request() req) {
    return this.authService.updateUserRole(req.user.userId, 'ADMIN');
  }

  // Admin endpoint to update any user's role
  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async updateUserRole(
    @Param('id') userId: string,
    @Body() body: { role: string },
  ) {
    return this.authService.updateUserRole(userId, body.role);
  }
}
