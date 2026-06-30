import { IsInt, IsString, IsEnum, IsOptional, Matches } from "class-validator";
import { DayOfWeek } from "@prisma/client";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description: "ID de la clase académica asociada",
    example: 1,
  })
  @IsInt()
  @IsOptional()
  classId?: number;

  @ApiPropertyOptional({
    description: "ID del aula donde se impartirá la clase",
    example: 1,
  })
  @IsInt()
  @IsOptional()
  classroomId?: number;

  @ApiPropertyOptional({
    description: "Día de la semana de la clase",
    enum: DayOfWeek,
    example: DayOfWeek.MONDAY,
  })
  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({
    description: "Hora de inicio de la clase en formato HH:mm",
    example: "07:00",
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de inicio debe ser HH:mm",
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: "Hora de fin de la clase en formato HH:mm",
    example: "08:30",
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El formato de hora de fin debe ser HH:mm",
  })
  endTime?: string;
}
