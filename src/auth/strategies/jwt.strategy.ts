import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  role?: string; // rol de Postgres (ej. "authenticated"), NO el rol de negocio (partner/admin)
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Valida el access token emitido por Supabase Auth (HS256, firmado con el
 * JWT secret del proyecto). El rol de negocio (partner/admin) NO viaja en
 * este token: se resuelve aparte contra la tabla `profiles` en RolesGuard,
 * para no depender de un custom access token hook en Supabase.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('supabase.jwtSecret'),
      audience: 'authenticated',
    });
  }

  validate(payload: SupabaseJwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
