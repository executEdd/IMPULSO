import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from "@nestjs/swagger";
import { InsightsService } from "./insights.service";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UserRole } from "../common/enums/roles.enum";
import {
  StudentInsightQueryDto,
  DashboardQueryDto,
} from "./dto/insights-query.dto";

@ApiTags("Insights")
@Controller("insights")
@ApiBearerAuth()
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get("students/:studentId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Obtener insights de un alumno" })
  @ApiOkResponse({ description: "Insights del alumno recuperados." })
  @ApiNotFoundResponse({ description: "Alumno no encontrado." })
  @ApiForbiddenResponse({ description: "Sin permiso para ver este alumno." })
  async getStudentInsight(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: { id: number; role: UserRole },
    @Query() query: StudentInsightQueryDto,
  ) {
    return this.insightsService.getStudentInsight(
      studentId,
      user,
      query.period,
    );
  }

  @Get("dashboard")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Obtener resumen general del dashboard" })
  @ApiOkResponse({ description: "Resumen del dashboard recuperado." })
  @ApiForbiddenResponse({ description: "Sin permiso para ver el dashboard." })
  async getDashboardSummary(
    @CurrentUser() user: { id: number; role: UserRole },
    @Query() query: DashboardQueryDto,
  ) {
    return this.insightsService.getDashboardSummary(
      user,
      query.period,
      query.groupId,
    );
  }
}
