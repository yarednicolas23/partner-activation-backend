import {
  Body,
  Controller,
  Get,
  Param,
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.rewardsService.updateReward(id, dto);
  }

  @Post(':id/redeem')
  @UseGuards(JwtAuthGuard)
  requestRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.rewardsService.requestRedemption(user.id, id);
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
