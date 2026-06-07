import { IsInt, IsString, IsEnum, IsOptional } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class UpdateScheduleDto {
  @IsInt()
  @IsOptional()
  subjectId?: number;

  @IsInt()
  @IsOptional()
  teacherId?: number;

  @IsInt()
  @IsOptional()
  groupId?: number;

  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  classroom?: string;
}
