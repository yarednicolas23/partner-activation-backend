import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { EmailModule } from '../email/email.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [SupabaseModule, AuthModule, MilestonesModule, EmailModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
