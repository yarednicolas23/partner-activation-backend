import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { LoginLinkController } from './login-link.controller';

@Module({
  imports: [SupabaseModule, AuthModule, EmailModule],
  controllers: [PartnersController, LoginLinkController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
