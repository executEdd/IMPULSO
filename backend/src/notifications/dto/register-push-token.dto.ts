import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterPushTokenDto {
  @ApiProperty({
    description: "Token FCM o endpoint de suscripción Web Push",
    example: "https://fcm.googleapis.com/fcm/send/ee6gbs7-...",
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description: "Plataforma del dispositivo o suscripción",
    enum: ["WEB_PUSH", "FCM_ANDROID", "FCM_IOS"],
    example: "WEB_PUSH",
  })
  @IsEnum(["WEB_PUSH", "FCM_ANDROID", "FCM_IOS"])
  @IsNotEmpty()
  platform!: "WEB_PUSH" | "FCM_ANDROID" | "FCM_IOS";

  @ApiPropertyOptional({
    description:
      "Clave pública Web Push (p256dh). Solo requerido para WEB_PUSH.",
    example: "BNJ...",
  })
  @IsOptional()
  @IsString()
  p256dh?: string;

  @ApiPropertyOptional({
    description:
      "Secreto de autenticación Web Push. Solo requerido para WEB_PUSH.",
    example: "G4...",
  })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiPropertyOptional({
    description: "User-Agent del navegador o dispositivo",
    example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
