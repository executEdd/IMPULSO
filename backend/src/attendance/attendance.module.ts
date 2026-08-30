import { Module } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { QrModule } from "../qr/qr.module";

@Module({
  imports: [NotificationsModule, QrModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
  exports: [AttendanceService],
})
export class AttendanceModule {}
