import { IsInt, IsString, IsEnum, IsOptional, Matches } from "class-validator";
import { DayOfWeek } from "@prisma/client";

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
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de inicio debe ser HH:mm",
  })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de fin debe ser HH:mm",
  })
  endTime?: string;

  @IsString()
  @IsOptional()
  classroom?: string;
}
