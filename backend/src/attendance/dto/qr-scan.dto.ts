import { IsString, IsInt, IsNotEmpty } from 'class-validator';

export class QrScanDto {
  @IsString()
  @IsNotEmpty({ message: 'El token QR es requerido' })
  qrToken: string;

  @IsInt()
  @IsNotEmpty({ message: 'El ID del horario es requerido' })
  scheduleId: number;
}
