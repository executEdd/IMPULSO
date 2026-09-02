import { PartialType } from "@nestjs/swagger";
import { CreateSchoolCycleDto } from "./create-school-cycle.dto";

export class UpdateSchoolCycleDto extends PartialType(CreateSchoolCycleDto) {}
