import { IsString, IsInt, IsNotEmpty, IsOptional, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class QrScanDto {
  @ApiProperty({
    description: "Token QR generado dinámicamente por el alumno",
    example: "some-dynamic-qr-token-uuid-or-jwt",
  })
  @IsString()
  @IsNotEmpty({ message: "El token QR es requerido" })
  qrToken!: string;

  @ApiProperty({
    description: "ID del bloque de horario de la clase (ClassSchedule ID)",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty({ message: "El ID del horario de clase (bloque) es requerido" })
  classScheduleId!: number;

  @ApiProperty({
    description: "Fecha y hora (ISO string) en la que el docente escaneó el código de forma offline. Si no se envía, se toma la hora actual del servidor.",
    example: "2026-08-27T10:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "scannedAt debe ser una fecha ISO válida" })
  scannedAt?: string;
}
