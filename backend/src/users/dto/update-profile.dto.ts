import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: "Nombre del usuario" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: "Apellidos del usuario" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: "Correo electrónico" })
  @IsOptional()
  @IsEmail({}, { message: "El correo electrónico no es válido" })
  email?: string;

  @ApiPropertyOptional({ description: "Nueva contraseña (opcional)" })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
  password?: string;

  @ApiPropertyOptional({ description: "Teléfono de contacto" })
  @IsOptional()
  @IsString()
  phone?: string;
}
