import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { DeadlinesService } from './deadlines.service';
import type { ExtensionStatus } from './deadline.interfaces';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { ReviewExtensionDto } from './dto/review-extension.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('deadlines')
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Partner)
  getOwnDeadline(@CurrentUser() user: AuthenticatedUser) {
    return this.deadlinesService.getOwnDeadline(user.id);
  }

  @Post('me/extension-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Partner)
  requestExtension(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestExtensionDto,
  ) {
    return this.deadlinesService.requestExtension(user.id, dto);
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  getSettings() {
    return this.deadlinesService.getSettings();
  }

  @Put('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.deadlinesService.updateSettings(user.id, dto);
  }

  @Get('admin/partners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listTimeline() {
    return this.deadlinesService.listTimeline();
  }

  @Get('admin/partners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  getPartnerDeadline(@Param('id', ParseUUIDPipe) id: string) {
    return this.deadlinesService.getDeadline(id);
  }

  @Put('admin/partners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  setPartnerDeadline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeadlineDto,
  ) {
    return this.deadlinesService.setDeadline(user.id, id, dto);
  }

  @Get('admin/extension-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listRequests(@Query('status') status?: ExtensionStatus) {
    return this.deadlinesService.listRequests(status);
  }

  @Patch('admin/extension-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  reviewRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewExtensionDto,
  ) {
    return this.deadlinesService.reviewRequest(user.id, id, dto);
  }
}
