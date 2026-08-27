import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { CustomThrottlerGuard } from "./common/guards/custom-throttler.guard";
import { PrismaModule } from "./prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { GradesModule } from "./grades/grades.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SubjectsModule } from "./subjects/subjects.module";
import { GroupsModule } from "./groups/groups.module";
import { ClassesModule } from "./classes/classes.module";
import { InsightsModule } from "./insights/insights.module";
import { AiInsightsModule } from "./ai-insights/ai-insights.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { QrModule } from "./qr/qr.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    AttendanceModule,
    SchedulesModule,
    GradesModule,
    NotificationsModule,
    SubjectsModule,
    GroupsModule,
    ClassesModule,
    InsightsModule,
    AiInsightsModule,
    QrModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
