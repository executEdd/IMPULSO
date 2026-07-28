import { IsInt, IsNotEmpty, IsOptional } from "class-validator";

export class CreateClassDto {
  @IsInt({ message: "El ID de la materia debe ser un número entero" })
  @IsNotEmpty({ message: "El ID de la materia es requerido" })
  subjectId!: number;

  @IsInt({ message: "El ID del grupo debe ser un número entero" })
  @IsNotEmpty({ message: "El ID del grupo es requerido" })
  groupId!: number;

  @IsInt({ message: "El ID del docente debe ser un número entero" })
  @IsNotEmpty({ message: "El ID del docente es requerido" })
  teacherId!: number;

  @IsInt({ message: "El ID del semestre debe ser un número entero" })
  @IsNotEmpty({ message: "El ID del semestre es requerido" })
  semesterId!: number;

  @IsInt({ message: "El ID del aula debe ser un número entero" })
  @IsOptional()
  classroomId?: number;
}
