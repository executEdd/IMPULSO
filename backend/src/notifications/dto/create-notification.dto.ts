import { IsInt, IsString, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateNotificationDto {
  @IsInt()
  @IsNotEmpty()
  alertId: number;

  @IsInt()
  @IsNotEmpty()
  recipientId: number;

  @IsString()
  @IsNotEmpty()
  recipientType: string;

  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
