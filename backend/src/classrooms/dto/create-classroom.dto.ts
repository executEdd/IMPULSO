import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateClassroomDto {
  @ApiProperty({
    description: "Nombre o identificador del salón (ej. Aula 101)",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: "Capacidad máxima de alumnos del salón" })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    description: "Descripción opcional (ej. Laboratorio de Cómputo)",
  })
  @IsOptional()
  @IsString()
  description?: string;
}
