export interface WeeklyCount {
  week: string;
  count: number;
}

export interface AdminStats {
  totalPartners: number;
  activatedPartners: number;
  activationRate: number;
  avgMilestoneCompletionRate: number;
  partnersCompletedProgram: number;
  avgTimeToFirstSaleDays: number | null;
  partnersRegisteredByWeek: WeeklyCount[];
}
