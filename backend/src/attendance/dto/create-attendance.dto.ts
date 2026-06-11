import {
  IsInt,
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export class CreateAttendanceDto {
  @IsInt()
  @IsNotEmpty()
  studentId: number;

  @IsInt()
  @IsNotEmpty()
  scheduleId: number;

  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @IsString()
  @IsOptional()
  qrToken?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
