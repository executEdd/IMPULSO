import { Module } from "@nestjs/common";
import { SchoolCyclesService } from "./school-cycles.service";
import { SchoolCyclesController } from "./school-cycles.controller";

@Module({
  controllers: [SchoolCyclesController],
  providers: [SchoolCyclesService],
  exports: [SchoolCyclesService],
})
export class SchoolCyclesModule {}
