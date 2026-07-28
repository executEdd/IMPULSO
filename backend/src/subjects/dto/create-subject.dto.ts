import { IsString, IsNotEmpty, IsOptional, IsNumber } from "class-validator";

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty({ message: "El nombre de la materia es requerido" })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: "El código de la materia es requerido" })
  code!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  credits?: number;

  @IsNumber()
  @IsOptional()
  teacherId?: number;
}
