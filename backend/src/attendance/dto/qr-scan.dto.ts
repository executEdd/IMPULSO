import { IsString, IsInt, IsNotEmpty } from "class-validator";
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
}
