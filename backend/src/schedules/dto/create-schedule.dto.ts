import { IsInt, IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class CreateScheduleDto {
  @IsInt()
  @IsNotEmpty()
  subjectId: number;

  @IsInt()
  @IsNotEmpty()
  teacherId: number;

  @IsInt()
  @IsNotEmpty()
  groupId: number;

  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  classroom?: string;
}
