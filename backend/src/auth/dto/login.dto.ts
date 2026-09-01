import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @IsEmail({}, { message: "El correo electrónico no es válido" })
  @IsNotEmpty({ message: "El correo electrónico es requerido" })
  email!: string;

  @IsString()
  @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
  @IsNotEmpty({ message: "La contraseña es requerida" })
  password!: string;

  @ApiPropertyOptional({ description: "Mantener la sesión iniciada por 15 días" })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
