import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../common/enums/roles.enum";

export class CreateGlobalNotificationDto {
  @ApiProperty({
    description: "Contenido o cuerpo del aviso global",
    example: "Mañana no habrá clases por fumigación.",
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    description: "Canal por el que se enviará (por defecto IN_APP)",
    enum: ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"],
    example: "IN_APP",
  })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({
    description: "Roles específicos que recibirán el aviso. Si se omite, se envía a todos los usuarios de la escuela.",
    enum: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT],
    isArray: true,
    example: [UserRole.STUDENT, UserRole.PARENT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  targetRoles?: UserRole[];
}

