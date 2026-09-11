export interface WeeklyCount {
  week: string;
  count: number;
}

export interface MilestoneDistributionEntry {
  milestoneId: string;
  orderIndex: number;
  title: string;
  partnerCount: number;
}

export interface AdminStats {
  totalPartners: number;
  activatedPartners: number;
  activationRate: number;
  avgMilestoneCompletionRate: number;
  partnersCompletedProgram: number;
  avgTimeToFirstSaleDays: number | null;
  partnersRegisteredByWeek: WeeklyCount[];
  partnersByMilestone: MilestoneDistributionEntry[];
}
