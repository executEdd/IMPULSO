export interface IGroupSemaphoreSummary {
  groupId: number;
  groupName: string;
  total: number;
  green: number;
  yellow: number;
  red: number;
}

export interface ISemaphoreSummaryResponse {
  totalStudents: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  riskCount: number;
  riskPercentage: number;
  byGroup: IGroupSemaphoreSummary[];
}
