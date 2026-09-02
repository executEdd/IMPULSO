import {
  IsInt,
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsDateString,
} from "class-validator";
import { AttendanceStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAttendanceDto {
  @ApiProperty({
    description: "ID del estudiante",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty({ message: "El ID del estudiante es requerido" })
  studentId!: number;

  @ApiProperty({
    description: "ID de la clase académica asociada",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty({ message: "El ID de la clase es requerido" })
  classId!: number;

  @ApiProperty({
    description: "ID del horario de clase (bloque) asociado",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty({
    message: "El ID del horario de clase (classScheduleId) es requerido",
  })
  classScheduleId!: number;

  @ApiProperty({
    description: "Estado de la asistencia",
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
  })
  @IsEnum(AttendanceStatus, {
    message: "El estado de asistencia debe ser válido",
  })
  @IsNotEmpty({ message: "El estado de asistencia es requerido" })
  status!: AttendanceStatus;

  @ApiPropertyOptional({
    description: "Fecha y hora del registro de asistencia (formato ISO 8601)",
    example: "2026-09-01T08:00:00.000Z",
  })
  @IsDateString(
    {},
    { message: "La fecha debe ser una cadena de fecha válida (ISO 8601)" },
  )
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    description: "Token QR utilizado para registrar la asistencia",
    example: "some-qr-token-string",
  })
  @IsString()
  @IsOptional()
  qrToken?: string;

  @ApiPropertyOptional({
    description: "Notas adicionales sobre el registro de asistencia",
    example: "Registro manual en clase",
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
