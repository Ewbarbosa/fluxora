import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AuditLogService } from './audit-log.service';
import { LoginLogService } from './login-log.service';
import { LogsController } from './logs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  controllers: [LogsController],
  providers: [AuditLogService, LoginLogService],
  exports: [AuditLogService, LoginLogService],
})
export class LogsModule {}
