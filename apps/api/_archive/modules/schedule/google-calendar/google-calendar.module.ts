import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '../schedule.module';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { GoogleCalendarSyncJobService } from './google-calendar-sync-job.service';
import { GoogleCalendarEncryptionService } from './google-calendar-encryption.service';
import { GoogleCalendarController } from './google-calendar.controller';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    NestScheduleModule.forRoot(),
    forwardRef(() => ScheduleModule),
  ],
  controllers: [GoogleCalendarController],
  providers: [
    GoogleCalendarEncryptionService,
    GoogleCalendarAuthService,
    {
      provide: 'GoogleCalendarSyncService',
      useClass: GoogleCalendarSyncService,
    },
    GoogleCalendarSyncService,
    GoogleCalendarSyncJobService,
  ],
  exports: [
    GoogleCalendarAuthService,
    GoogleCalendarSyncService,
    'GoogleCalendarSyncService',
  ],
})
export class GoogleCalendarModule {}
