import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  IsEnum,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";
import { DayOfWeek } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateScheduleSlotDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ example: "07:00" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora debe ser HH:mm",
  })
  startTime!: string;

  @ApiProperty({ example: "08:30" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora debe ser HH:mm",
  })
  endTime!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  classroomId?: number;
}

export class CreateClassDto {
  @ApiProperty({ example: 1 })
  @IsInt({ message: "El ID de la materia debe ser un número entero" })
  @IsNotEmpty({ message: "El ID de la materia es requerido" })
  subjectId!: number;

  @ApiProperty({ example: 1 })
  @IsInt({ message: "El ID del grupo debe ser un número entero" })
  @IsNotEmpty({ message: "El ID del grupo es requerido" })
  groupId!: number;

  @ApiProperty({ example: 1 })
  @IsInt({ message: "El ID del docente debe ser un número entero" })
  @IsNotEmpty({ message: "El ID del docente es requerido" })
  teacherId!: number;

  @ApiProperty({ example: 1 })
  @IsInt({ message: "El ID del semestre debe ser un número entero" })
  @IsNotEmpty({ message: "El ID del semestre es requerido" })
  semesterId!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt({ message: "El ID del aula debe ser un número entero" })
  @IsOptional()
  classroomId?: number;

  @ApiPropertyOptional({ type: [CreateScheduleSlotDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleSlotDto)
  schedules?: CreateScheduleSlotDto[];
}
