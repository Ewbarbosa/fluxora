import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [DatabaseModule, AuthModule, LogsModule, LimitsModule],
  providers: [ContactService],
  controllers: [ContactController],
})
export class ContactModule {}
