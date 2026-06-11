import { IsNumber, IsOptional, Min, Max } from "class-validator";

export class UpdateGradeDto {
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
}
