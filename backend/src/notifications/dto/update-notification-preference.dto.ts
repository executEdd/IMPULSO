import { IsBoolean, IsEnum, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateNotificationPreferenceDto {
  @ApiProperty({
    description: "Canal de notificación a configurar",
    enum: ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"],
    example: "EMAIL",
  })
  @IsEnum(["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"])
  @IsNotEmpty()
  channel!: string;

  @ApiProperty({
    description: "Indica si el canal está habilitado para el usuario",
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  enabled!: boolean;
}
