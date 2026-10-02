import { IsEmail, IsIn, IsOptional } from 'class-validator';

// Destinos permitidos após o login (evita open redirect via `next`).
export const LOGIN_NEXT_PATHS = ['/dashboard', '/admin/dashboard'] as const;

export class LoginLinkDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(LOGIN_NEXT_PATHS)
  next?: (typeof LOGIN_NEXT_PATHS)[number];
}
