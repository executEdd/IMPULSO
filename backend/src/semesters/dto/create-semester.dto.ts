import { IsString, IsNotEmpty, IsInt, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateSemesterDto {
  @ApiProperty({
    description: "Nombre del semestre (ej. Agosto - Diciembre 2026)",
  })
  @IsString()
  @IsNotEmpty()
  semesterName: string;

  @ApiProperty({ description: "Fecha de inicio del semestre (ISO 8601)" })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: "Fecha de fin del semestre (ISO 8601)" })
  @IsDateString()
  finishDate: string;

  @ApiProperty({ description: "ID del ciclo escolar al que pertenece" })
  @IsInt()
  schoolCycleId: number;
}
