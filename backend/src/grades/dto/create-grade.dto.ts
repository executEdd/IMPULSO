import { IsInt, IsNumber, IsString, IsOptional, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateGradeDto {
  @IsInt()
  @IsNotEmpty()
  studentId: number;

  @IsInt()
  @IsNotEmpty()
  subjectId: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  partial1?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  partial2?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  partial3?: number;

  @IsString()
  @IsNotEmpty()
  period: string;
}
