import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

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
 * Valida el access token emitido por Supabase Auth contra el JWKS del
 * proyecto (claves de firma asimétricas ECC P-256 / ES256). Supabase migró
 * de un secreto HS256 compartido a JWT Signing Keys asimétricas
 * (2026-08-07) — verificar contra un secreto estático ya no sirve para
 * tokens nuevos, hay que resolver la clave pública por `kid` vía JWKS.
 * El rol de negocio (partner/admin) NO viaja en este token: se resuelve
 * aparte contra la tabla `profiles` en RolesGuard, para no depender de un
 * custom access token hook en Supabase.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const supabaseUrl = configService.getOrThrow<string>('supabase.url');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: 'authenticated',
      algorithms: ['ES256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: SupabaseJwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
