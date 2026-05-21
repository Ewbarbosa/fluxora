import { forwardRef, Module } from '@nestjs/common';
import { TenantLimitsService } from './tenant-limits.service';
import { LimitsController } from './limits.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  controllers: [LimitsController],
  providers: [TenantLimitsService],
  exports: [TenantLimitsService],
})
export class LimitsModule {}
