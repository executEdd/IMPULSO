import { IsOptional, IsString, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class StudentAiInsightQueryDto {
  @IsOptional()
  @IsString()
  period?: string;
}

export class DashboardAiInsightQueryDto {
  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number;
}
