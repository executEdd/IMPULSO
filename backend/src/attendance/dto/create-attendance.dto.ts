import {
  IsInt,
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from "class-validator";
import { AttendanceStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAttendanceDto {
  @ApiProperty({
    description: "ID del estudiante",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  studentId!: number;

  @ApiProperty({
    description: "ID de la clase académica asociada",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  classId!: number;

  @ApiProperty({
    description: "Estado de la asistencia",
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
  })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status!: AttendanceStatus;

  @ApiPropertyOptional({
    description: "Token QR utilizado para registrar la asistencia",
    example: "some-qr-token-string",
  })
  @IsString()
  @IsOptional()
  qrToken?: string;

  @ApiPropertyOptional({
    description: "Notas adicionales sobre el registro de asistencia",
    example: "Llegó tarde pero justificado",
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
