import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';
import { PlansController } from './plans.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PlansController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlansModule {}
