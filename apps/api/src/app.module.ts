import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { FinanceModule } from './modules/finance/finance.module';
import { EmailModule } from './modules/email/email.module';
import { LogsModule } from './modules/logs/logs.module';
import { LimitsModule } from './modules/limits/limits.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    DatabaseModule,
    ProfileModule,
    TenantModule,
    FinanceModule,
    EmailModule,
    LogsModule,
    LimitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
