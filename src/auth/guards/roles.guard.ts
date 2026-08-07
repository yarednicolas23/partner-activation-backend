import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import { Role } from '../roles.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Debe usarse siempre después de JwtAuthGuard, ej:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.Admin)
 *
 * Resuelve el rol de negocio consultando `profiles` (no confía en el JWT
 * para esto, ver nota en jwt.strategy.ts).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      throw new ForbiddenException('No se pudo resolver el perfil del usuario');
    }

    const hasRole = requiredRoles.includes(data.role as Role);
    if (!hasRole) {
      throw new ForbiddenException('Rol insuficiente para esta acción');
    }

    return true;
  }
}
