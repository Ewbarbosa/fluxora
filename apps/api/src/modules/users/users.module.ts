import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';
import { LimitsModule } from '../limits/limits.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AuthModule),
    LogsModule,
    LimitsModule,
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
