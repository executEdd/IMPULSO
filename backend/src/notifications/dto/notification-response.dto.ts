import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationResponseDto {
  @ApiProperty({ description: "ID de la notificación", example: 1 })
  id!: number;

  @ApiProperty({
    description: "ID de la alerta relacionada",
    example: 1,
  })
  alertId!: number;

  @ApiProperty({
    description: "ID del usuario que envió la notificación",
    example: 2,
  })
  senderId!: number;

  @ApiProperty({
    description: "Rol del destinatario",
    enum: ["STUDENT", "PARENT", "TEACHER", "ADMIN"],
    example: "PARENT",
  })
  recipientType!: string;

  @ApiProperty({
    description: "ID del destinatario",
    example: 5,
  })
  recipientId!: number;

  @ApiProperty({
    description: "Canal de envío",
    enum: ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"],
    example: "EMAIL",
  })
  channel!: string;

  @ApiProperty({
    description: "Estado actual de la notificación",
    enum: ["PENDING", "SENT", "FAILED", "SIMULATED", "READ"],
    example: "SENT",
  })
  status!: string;

  @ApiProperty({
    description: "Contenido del mensaje enviado",
    example: "Su hijo(a) tiene 3 faltas acumuladas.",
  })
  content!: string;

  @ApiPropertyOptional({
    description:
      "Metadata adicional. Usado para indicar si el envío fue simulado y por qué.",
    example: {
      simulated: true,
      reason: "SMS provider not configured",
      retryable: true,
    },
  })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Fecha y hora en que se envió la notificación",
    example: "2026-08-01T12:00:00.000Z",
  })
  sentAt?: Date;

  @ApiProperty({
    description: "Fecha y hora de creación",
    example: "2026-08-01T12:00:00.000Z",
  })
  createdAt!: Date;
}
