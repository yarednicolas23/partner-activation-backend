import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { ReviewRedemptionDto } from './dto/review-redemption.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { CreateImageUploadUrlDto } from './dto/create-image-upload-url.dto';
import type { RedemptionStatus } from './reward.interfaces';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  createReward(@Body() dto: CreateRewardDto) {
    return this.rewardsService.createReward(dto);
  }

  @Post('images/upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  createImageUploadUrl(@Body() dto: CreateImageUploadUrlDto) {
    return this.rewardsService.createImageUploadPost(dto.contentType);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listAllRewards() {
    return this.rewardsService.listAllRewards();
  }

  @Get('eligible')
  @UseGuards(JwtAuthGuard)
  listEligibleRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listEligibleRewards(user.id);
  }

  @Get('catalog')
  @UseGuards(JwtAuthGuard)
  listCatalog() {
    return this.rewardsService.listCatalog();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.rewardsService.updateReward(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  deleteReward(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewardsService.deleteReward(id);
  }

  @Post(':id/redeem')
  @UseGuards(JwtAuthGuard)
  requestRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RedeemRewardDto,
  ) {
    return this.rewardsService.requestRedemption(
      user.id,
      id,
      dto.addressConfirmed ?? false,
    );
  }

  @Get('redemptions/me')
  @UseGuards(JwtAuthGuard)
  listMyRedemptions(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMyRedemptions(user.id);
  }

  @Get('admin/redemptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listRedemptionQueue(@Query('status') status?: RedemptionStatus) {
    return this.rewardsService.listRedemptionQueue(status);
  }

  @Get('admin/partners/:partnerId/redemptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listPartnerRedemptions(@Param('partnerId', ParseUUIDPipe) partnerId: string) {
    return this.rewardsService.listMyRedemptions(partnerId);
  }

  @Patch('admin/redemptions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  reviewRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewRedemptionDto,
  ) {
    return this.rewardsService.reviewRedemption(
      id,
      user.id,
      dto.status,
      dto.note,
    );
  }
}
