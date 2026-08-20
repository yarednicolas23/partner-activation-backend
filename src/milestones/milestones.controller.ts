import {
  BadRequestException,
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
import { MilestonesService } from './milestones.service';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { ReviewEvidenceDto } from './dto/review-evidence.dto';
import type { EvidenceStatus } from './milestone.interfaces';

@Controller()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get('milestones')
  @UseGuards(JwtAuthGuard)
  getMilestones(@CurrentUser() user: AuthenticatedUser) {
    return this.milestonesService.getPartnerView(user.id);
  }

  @Get('milestones/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listAllMilestones() {
    return this.milestonesService.listAllMilestones();
  }

  @Post('milestones/tasks/:taskId/evidence/upload-url')
  @UseGuards(JwtAuthGuard)
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.milestonesService.createFileUploadPost(
      user.id,
      taskId,
      dto.contentType,
    );
  }

  @Post('milestones/tasks/:taskId/evidence')
  @UseGuards(JwtAuthGuard)
  submitEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: SubmitEvidenceDto,
  ) {
    if (dto.filePath) {
      return this.milestonesService.submitFileEvidence(
        user.id,
        taskId,
        dto.filePath,
      );
    }
    if (!dto.textValue) {
      throw new BadRequestException('Envie textValue ou filePath');
    }
    return this.milestonesService.submitTextEvidence(
      user.id,
      taskId,
      dto.textValue,
    );
  }

  @Get('milestones/admin/evidence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listEvidenceQueue(@Query('status') status?: EvidenceStatus) {
    return this.milestonesService.listEvidenceQueue(status);
  }

  @Get('milestones/admin/partners/:partnerId/evidence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listPartnerEvidenceHistory(@Param('partnerId') partnerId: string) {
    return this.milestonesService.listPartnerEvidenceHistory(partnerId);
  }

  @Get('milestones/admin/evidence/:id/file-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async getEvidenceFileUrl(@Param('id') id: string) {
    const url = await this.milestonesService.getEvidenceFileUrl(id);
    return { url };
  }

  @Patch('milestones/admin/evidence/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  reviewEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewEvidenceDto,
  ) {
    return this.milestonesService.reviewEvidence(
      id,
      user.id,
      dto.status,
      dto.note,
    );
  }
}
