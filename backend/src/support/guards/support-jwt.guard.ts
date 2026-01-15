import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SupportJwtAuthGuard extends AuthGuard('support-jwt') {}
