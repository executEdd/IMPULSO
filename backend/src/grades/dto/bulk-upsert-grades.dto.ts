import {
  IsInt,
  IsNumber,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class BulkGradeItemDto {
  @IsInt()
  @IsNotEmpty()
  studentId!: number;

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

export class BulkUpsertGradesDto {
  @IsInt()
  @IsNotEmpty()
  subjectId!: number;

  @IsString()
  @IsNotEmpty()
  period!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeItemDto)
  grades!: BulkGradeItemDto[];
}
