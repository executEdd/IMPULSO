import {
  IsInt,
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Matches,
} from "class-validator";
import { DayOfWeek } from "@prisma/client";

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
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de inicio debe ser HH:mm",
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de fin debe ser HH:mm",
  })
  endTime: string;

  @IsString()
  @IsOptional()
  classroom?: string;
}
