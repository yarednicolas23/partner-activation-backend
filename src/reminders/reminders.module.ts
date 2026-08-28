import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SupabaseModule } from '../supabase/supabase.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { EmailModule } from '../email/email.module';
import { RemindersService } from './reminders.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SupabaseModule,
    MilestonesModule,
    EmailModule,
  ],
  providers: [RemindersService],
})
export class RemindersModule {}
