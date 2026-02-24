import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupportController } from './support.controller';
import { SupportAuthController } from './support-auth.controller';
import { SupportService } from './support.service';
import { SupportAuthService } from './support-auth.service';
import { SupportJwtStrategy } from './strategies/support-jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'support-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SupportController, SupportAuthController],
  providers: [
    SupportService,
    SupportAuthService,
    SupportJwtStrategy,
  ],
  exports: [SupportService],
})
export class SupportModule {}
