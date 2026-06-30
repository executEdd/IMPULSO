import {
  IsInt,
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Matches,
} from "class-validator";
import { DayOfWeek } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateScheduleDto {
  @ApiProperty({
    description: "ID de la clase académica asociada",
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  classId!: number;

  @ApiPropertyOptional({
    description: "ID del aula donde se impartirá la clase",
    example: 1,
  })
  @IsInt()
  @IsOptional()
  classroomId?: number;

  @ApiProperty({
    description: "Día de la semana de la clase",
    enum: DayOfWeek,
    example: DayOfWeek.MONDAY,
  })
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek!: DayOfWeek;

  @ApiProperty({
    description: "Hora de inicio de la clase en formato HH:mm",
    example: "07:00",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de inicio debe ser HH:mm",
  })
  startTime!: string;

  @ApiProperty({
    description: "Hora de fin de la clase en formato HH:mm",
    example: "08:30",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de fin debe ser HH:mm",
  })
  endTime!: string;
}
