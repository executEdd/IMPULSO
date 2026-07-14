import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del grupo es requerido' })
  name: string;

  @IsInt()
  @Min(1, { message: 'El grado mínimo es 1' })
  @Max(6, { message: 'El grado máximo es 6' })
  gradeLevel: number;

  @IsString()
  @IsNotEmpty({ message: 'La carrera/especialidad es requerida' })
  career: string;
}
