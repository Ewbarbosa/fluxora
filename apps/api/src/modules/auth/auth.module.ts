import { JwtModule } from '@nestjs/jwt';
import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from 'src/database/database.module';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { MfaService } from './mfa.service';
import { LogsModule } from '../logs/logs.module';
import { EmailModule } from '../email/email.module';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { SsoService } from './sso.service';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SECRET_KEY,
      signOptions: { expiresIn: '1d' },
    }),
    DatabaseModule,
    forwardRef(() => UsersModule),
    LogsModule,
    EmailModule,
    forwardRef(() => LimitsModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, MfaService, PermissionsGuard, SsoService],
  exports: [AuthGuard, AuthService, JwtModule, MfaService, PermissionsGuard],
})
export class AuthModule {}
