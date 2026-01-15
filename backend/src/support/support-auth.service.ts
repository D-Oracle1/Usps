import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSupportUserDto, LoginSupportUserDto } from './dto/support-user.dto';

@Injectable()
export class SupportAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterSupportUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.supportUser.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.supportUser.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: hashedPassword,
        phone: dto.phone,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return this.generateToken(user);
  }

  async login(dto: LoginSupportUserDto) {
    const user = await this.prisma.supportUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update online status
    await this.prisma.supportUser.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    return this.generateToken(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.supportUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isOnline: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'support_user'
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
    };
  }
}
