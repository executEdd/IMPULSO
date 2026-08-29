import { Module } from "@nestjs/common";
import { ClassroomsService } from "./classrooms.service";
import { ClassroomsController } from "./classrooms.controller";

@Module({
  controllers: [ClassroomsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}
