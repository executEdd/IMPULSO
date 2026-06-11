import { IsInt, IsString, IsNotEmpty, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendManualNotificationDto {
  @ApiProperty({
    description: "ID del alumno asociado a la notificación",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  studentId: number;

  @ApiProperty({
    description: "Tipo de destinatario (usualmente PARENT para el tutor)",
    example: "PARENT",
    enum: ["STUDENT", "PARENT", "TEACHER", "ADMIN"],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(["STUDENT", "PARENT", "TEACHER", "ADMIN"])
  recipientType: string;

  @ApiProperty({
    description: "Canal de envío",
    example: "EMAIL",
    enum: ["EMAIL", "SMS", "IN_APP"],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(["EMAIL", "SMS", "IN_APP"])
  channel: string;

  @ApiProperty({
    description: "Contenido del mensaje de la notificación",
    example: "CBTIS 61: Su hijo(a) tiene 3 faltas acumuladas.",
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
