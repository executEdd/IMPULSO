import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendManualNotificationDto {
  @ApiPropertyOptional({
    description: "ID del alumno asociado a la notificación (legacy field)",
    example: 1,
  })
  @IsInt()
  @IsOptional()
  studentId?: number;

  @ApiProperty({
    description: "ID del destinatario asociado a la notificación",
    example: 1,
  })
  @IsInt()
  @IsOptional()
  recipientId?: number;

  @ApiProperty({
    description: "Tipo de destinatario (usualmente PARENT para el tutor)",
    example: "PARENT",
    enum: ["STUDENT", "PARENT", "TEACHER", "ADMIN"],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(["STUDENT", "PARENT", "TEACHER", "ADMIN"])
  recipientType!: string;

  @ApiProperty({
    description: "Canal de envío",
    example: "EMAIL",
    enum: ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"])
  channel!: string;

  @ApiProperty({
    description: "Contenido del mensaje de la notificación",
    example: "CBTIS 61: Su hijo(a) tiene 3 faltas acumuladas.",
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
