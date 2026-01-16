import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateAdminDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(createAdminDto: CreateAdminDto) {
    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    // Always create USER accounts via public registration
    // ADMIN accounts must be created by existing SUPER_ADMIN
    const user = await this.prisma.adminUser.create({
      data: {
        name: createAdminDto.name,
        email: createAdminDto.email,
        passwordHash: hashedPassword,
        role: UserRole.USER,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateUserRole(userId: string, role: string) {
    const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(role)) {
      throw new UnauthorizedException('Invalid role');
    }

    const user = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { role: role as any },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return user;
  }
}
