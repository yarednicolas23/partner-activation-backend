import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { MilestonesService } from './milestones.service';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
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

  @Post('milestones/tasks/:taskId/evidence')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  submitEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: SubmitEvidenceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      return this.milestonesService.submitFileEvidence(user.id, taskId, file);
    }
    if (!dto.textValue) {
      throw new BadRequestException('Envie textValue ou um arquivo');
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
