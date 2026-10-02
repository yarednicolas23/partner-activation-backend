import { IsEmail, IsIn, IsOptional } from 'class-validator';

// `next` é aceito por compatibilidade com o formulário, mas ignorado: o
// backend escolhe o destino pelo rol do usuário (admin → /admin/dashboard).
export const LOGIN_NEXT_PATHS = ['/dashboard', '/admin/dashboard'] as const;

export class LoginLinkDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(LOGIN_NEXT_PATHS)
  next?: (typeof LOGIN_NEXT_PATHS)[number];
}
