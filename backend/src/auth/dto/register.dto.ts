import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsEnum,
} from "class-validator";
import { UserRole } from "../../common/enums/roles.enum";

export class RegisterDto {
  @IsEmail({}, { message: "El correo electrónico no es válido" })
  @IsNotEmpty({ message: "El correo electrónico es requerido" })
  email: string;

  @IsString()
  @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
  @IsNotEmpty({ message: "La contraseña es requerida" })
  password: string;

  @IsString()
  @IsNotEmpty({ message: "El nombre es requerido" })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: "El apellido es requerido" })
  lastName: string;

  @IsEnum(UserRole, { message: "El rol no es válido" })
  @IsNotEmpty({ message: "El rol es requerido" })
  role: UserRole;
}
