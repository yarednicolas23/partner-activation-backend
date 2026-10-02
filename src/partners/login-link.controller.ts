import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { LoginLinkDto } from './dto/login-link.dto';

/**
 * Endpoint público (sem JWT): pedir o magic link de login. Substitui o
 * signInWithOtp do Supabase no frontend para que o e-mail use a plantilla
 * da plataforma (Resend) em vez do template do Supabase.
 */
@Controller('auth')
export class LoginLinkController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('login-link')
  @HttpCode(204)
  sendLoginLink(@Body() dto: LoginLinkDto) {
    return this.partnersService.sendLoginLink(dto.email);
  }
}
