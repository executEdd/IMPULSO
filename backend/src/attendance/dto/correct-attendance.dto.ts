import { IsString, IsOptional, IsEnum, IsNotEmpty } from "class-validator";
import { AttendanceStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CorrectAttendanceDto {
  @ApiProperty({
    description: "Nuevo estado de la asistencia",
    enum: AttendanceStatus,
    example: AttendanceStatus.JUSTIFIED,
  })
  @IsEnum(AttendanceStatus, {
    message: "El estado debe ser uno válido: PRESENT, ABSENT, LATE, JUSTIFIED",
  })
  @IsNotEmpty({ message: "El nuevo estado de asistencia es requerido" })
  status!: AttendanceStatus;

  @ApiProperty({
    description:
      "Motivo obligatorio de la corrección manual (para registro de auditoría)",
    example: "Presentó justificante médico oficial foliado",
  })
  @IsString({ message: "El motivo debe ser una cadena de texto" })
  @IsNotEmpty({ message: "El motivo de la corrección es obligatorio" })
  reason!: string;

  @ApiPropertyOptional({
    description: "Notas adicionales opcionales para complementar el registro",
    example: "Folio: MED-2026-8891",
  })
  @IsString({ message: "Las notas deben ser una cadena de texto" })
  @IsOptional()
  notes?: string;
}
