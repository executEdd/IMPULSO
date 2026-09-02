import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsInt,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateStudentDto {
  // --- Student User Data ---
  @ApiProperty({ example: "Juan" })
  @IsString()
  @IsNotEmpty()
  studentFirstName: string;

  @ApiProperty({ example: "Pérez García" })
  @IsString()
  @IsNotEmpty()
  studentLastName: string;

  @ApiProperty({ example: "juan.perez@alumno.edu.mx" })
  @IsEmail()
  studentEmail: string;

  @ApiProperty({
    example: "password123",
    required: false,
    description: "Optional. Auto-generated if not provided",
  })
  @IsString()
  @IsOptional()
  studentPassword?: string;

  // --- Student Profile Data ---
  @ApiProperty({ example: "183204928" })
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  groupId: number;

  @ApiProperty({ example: "5559876543", required: false })
  @IsString()
  @IsOptional()
  studentPhone?: string;

  // --- Parent User Data ---
  @ApiProperty({ example: "María" })
  @IsString()
  @IsNotEmpty()
  parentFirstName: string;

  @ApiProperty({ example: "García" })
  @IsString()
  @IsNotEmpty()
  parentLastName: string;

  @ApiProperty({
    example: "maria.garcia@gmail.com",
    required: false,
    description: "If existing, will link to existing parent",
  })
  @IsEmail()
  @IsOptional()
  parentEmail?: string;

  @ApiProperty({ example: "password123", required: false })
  @IsString()
  @IsOptional()
  parentPassword?: string;

  // --- Parent Profile Data ---
  @ApiProperty({ example: "5551234567" })
  @IsString()
  @IsNotEmpty()
  parentPhone: string;

  @ApiProperty({ example: "Calle Falsa 123", required: false })
  @IsString()
  @IsOptional()
  parentAddress?: string;
}
