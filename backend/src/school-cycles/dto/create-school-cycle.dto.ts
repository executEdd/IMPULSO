import { IsString, IsNotEmpty, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateSchoolCycleDto {
  @ApiProperty({ description: "Nombre del ciclo escolar (ej. 2026-2027)" })
  @IsString()
  @IsNotEmpty()
  cycleName: string;

  @ApiProperty({ description: "Fecha de inicio del ciclo escolar" })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: "Fecha de fin del ciclo escolar" })
  @IsDateString()
  @IsNotEmpty()
  finishDate: string;
}
