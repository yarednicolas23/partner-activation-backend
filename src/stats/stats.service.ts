import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminStats, WeeklyCount } from './stats.interfaces';

interface TaskRow {
  id: string;
  milestone_id: string;
  evidence_type: string;
}

interface EvidenceRow {
  partner_id: string;
  task_id: string;
  status: string;
  reviewed_at: string | null;
}

interface PartnerRow {
  id: string;
  created_at: string;
}

interface MilestoneRow {
  id: string;
  order_index: number;
}

/**
 * KPIs priorizados para MVP (CLAUDE.md §"Objetivo del programa"): tasa de
 * activación, tasa de finalización de milestones, tiempo a la primera venta.
 * Calculados en el momento a partir de las tablas existentes — sin tabla de
 * agregación separada, mismo criterio que el resto del motor de milestones.
 */
@Injectable()
export class StatsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getAdminStats(): Promise<AdminStats> {
    const [
      { data: partners, error: partnersError },
      { data: milestones, error: milestonesError },
      { data: tasks, error: tasksError },
      { data: evidence, error: evidenceError },
    ] = await Promise.all([
      this.client
        .from('profiles')
        .select('id, created_at')
        .eq('role', 'partner'),
      this.client
        .from('milestones')
        .select('id, order_index')
        .order('order_index'),
      this.client
        .from('milestone_tasks')
        .select('id, milestone_id, evidence_type'),
      this.client
        .from('task_evidence')
        .select('partner_id, task_id, status, reviewed_at'),
    ]);

    if (partnersError || milestonesError || tasksError || evidenceError) {
      throw new InternalServerErrorException(
        partnersError?.message ??
          milestonesError?.message ??
          tasksError?.message ??
          evidenceError?.message,
      );
    }

    const partnerRows = (partners ?? []) as PartnerRow[];
    const milestoneRows = (milestones ?? []) as MilestoneRow[];
    const taskRows = (tasks ?? []) as TaskRow[];
    const evidenceRows = (evidence ?? []) as EvidenceRow[];

    const requiredTaskIdsByMilestone = new Map<string, string[]>();
    for (const task of taskRows) {
      if (task.evidence_type === 'none') continue;
      const list = requiredTaskIdsByMilestone.get(task.milestone_id) ?? [];
      list.push(task.id);
      requiredTaskIdsByMilestone.set(task.milestone_id, list);
    }

    const evidenceByPartnerTask = new Map<string, EvidenceRow>();
    const evidenceCountByPartner = new Map<string, number>();
    for (const row of evidenceRows) {
      evidenceByPartnerTask.set(`${row.partner_id}:${row.task_id}`, row);
      evidenceCountByPartner.set(
        row.partner_id,
        (evidenceCountByPartner.get(row.partner_id) ?? 0) + 1,
      );
    }

    const totalMilestones = milestoneRows.length;
    const lastMilestone = milestoneRows[milestoneRows.length - 1];
    const lastMilestoneTaskIds = lastMilestone
      ? (requiredTaskIdsByMilestone.get(lastMilestone.id) ?? [])
      : [];

    let activatedCount = 0;
    let completionRatioSum = 0;
    let programCompletedCount = 0;
    const firstSaleDurationsMs: number[] = [];
    const registeredByWeek = new Map<string, number>();

    for (const partner of partnerRows) {
      if ((evidenceCountByPartner.get(partner.id) ?? 0) > 0) {
        activatedCount++;
      }

      let completedMilestones = 0;
      for (const milestone of milestoneRows) {
        const requiredIds = requiredTaskIdsByMilestone.get(milestone.id) ?? [];
        const allApproved =
          requiredIds.length > 0 &&
          requiredIds.every(
            (taskId) =>
              evidenceByPartnerTask.get(`${partner.id}:${taskId}`)?.status ===
              'approved',
          );
        if (allApproved) completedMilestones++;
      }
      completionRatioSum +=
        totalMilestones > 0 ? completedMilestones / totalMilestones : 0;

      if (totalMilestones > 0 && completedMilestones === totalMilestones) {
        programCompletedCount++;

        const latestReviewMs = lastMilestoneTaskIds.reduce((max, taskId) => {
          const reviewedAt = evidenceByPartnerTask.get(
            `${partner.id}:${taskId}`,
          )?.reviewed_at;
          return reviewedAt
            ? Math.max(max, new Date(reviewedAt).getTime())
            : max;
        }, 0);

        if (latestReviewMs > 0) {
          firstSaleDurationsMs.push(
            latestReviewMs - new Date(partner.created_at).getTime(),
          );
        }
      }

      const week = weekLabel(partner.created_at);
      registeredByWeek.set(week, (registeredByWeek.get(week) ?? 0) + 1);
    }

    const totalPartners = partnerRows.length;
    const avgTimeToFirstSaleDays =
      firstSaleDurationsMs.length > 0
        ? firstSaleDurationsMs.reduce((a, b) => a + b, 0) /
          firstSaleDurationsMs.length /
          (1000 * 60 * 60 * 24)
        : null;

    const partnersRegisteredByWeek: WeeklyCount[] = [
      ...registeredByWeek.entries(),
    ]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count }));

    return {
      totalPartners,
      activatedPartners: activatedCount,
      activationRate: totalPartners > 0 ? activatedCount / totalPartners : 0,
      avgMilestoneCompletionRate:
        totalPartners > 0 ? completionRatioSum / totalPartners : 0,
      partnersCompletedProgram: programCompletedCount,
      avgTimeToFirstSaleDays,
      partnersRegisteredByWeek,
    };
  }
}

function weekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getUTCDay();
  // Semana empieza el lunes — ISO 8601, evita que domingo quede "adelantado".
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}
