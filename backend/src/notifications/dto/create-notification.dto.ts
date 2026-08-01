import { IsInt, IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateNotificationDto {
  @ApiProperty({
    description: "ID de la alerta asociada a la notificación",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  alertId!: number;

  @ApiProperty({
    description: "ID del usuario destinatario",
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  recipientId!: number;

  @ApiProperty({
    description: "Rol del destinatario",
    enum: ["STUDENT", "PARENT", "TEACHER", "ADMIN"],
    example: "PARENT",
  })
  @IsString()
  @IsNotEmpty()
  recipientType!: string;

  @ApiProperty({
    description: "Canal por el que se enviará la notificación",
    enum: ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"],
    example: "EMAIL",
  })
  @IsString()
  @IsNotEmpty()
  channel!: string;

  @ApiProperty({
    description: "Contenido de la notificación",
    example: "Su hijo(a) tiene 3 faltas acumuladas.",
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
