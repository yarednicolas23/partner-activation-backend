import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  invitePartner(@Body() dto: CreatePartnerDto) {
    return this.partnersService.invitePartner(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.partnersService.getProfile(user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listPartners() {
    return this.partnersService.listPartners();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  getPartner(@Param('id') id: string) {
    return this.partnersService.getProfile(id);
  }
}
