import { IsOptional, IsString, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class StudentInsightQueryDto {
  @IsOptional()
  @IsString()
  period?: string;
}

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number;
}
