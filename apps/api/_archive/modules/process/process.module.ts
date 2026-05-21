import { Module } from '@nestjs/common';
import { ProcessService } from './process.service';
import { ProcessController } from './process.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [DatabaseModule, AuthModule, LogsModule, LimitsModule],
  providers: [ProcessService],
  controllers: [ProcessController],
})
export class ProcessModule {}
