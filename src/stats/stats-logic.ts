import { AdminStats, WeeklyCount } from './stats.interfaces';

/**
 * Lógica pura de cálculo de KPIs — separada de StatsService para poder
 * testearla sin mockear Supabase. Ver stats-logic.spec.ts.
 */

export interface TaskRow {
  id: string;
  milestone_id: string;
  evidence_type: string;
}

export interface EvidenceRow {
  partner_id: string;
  task_id: string;
  status: string;
  reviewed_at: string | null;
}

export interface PartnerRow {
  id: string;
  created_at: string;
}

export interface MilestoneRow {
  id: string;
  order_index: number;
}

export function weekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getUTCDay();
  // Semana empieza el lunes — ISO 8601, evita que domingo quede "adelantado".
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

export function computeAdminStats(
  partnerRows: PartnerRow[],
  milestoneRows: MilestoneRow[],
  taskRows: TaskRow[],
  evidenceRows: EvidenceRow[],
): AdminStats {
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
        return reviewedAt ? Math.max(max, new Date(reviewedAt).getTime()) : max;
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
