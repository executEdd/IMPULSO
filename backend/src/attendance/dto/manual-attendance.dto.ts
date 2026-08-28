import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class ManualAttendanceDto {
  @ApiProperty({ example: 1, description: "ID del estudiante" })
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiProperty({ example: 1, description: "ID del horario de clase" })
  @IsInt()
  @Min(1)
  classScheduleId: number;

  @ApiProperty({
    example: "password123",
    description: "Contraseña del docente/admin para confirmar",
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
