import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { DeadlinesController } from './deadlines.controller';
import { DeadlinesService } from './deadlines.service';

@Module({
  imports: [SupabaseModule, AuthModule, MilestonesModule],
  controllers: [DeadlinesController],
  providers: [DeadlinesService],
})
export class DeadlinesModule {}
