import { Controller, Post, Param, ParseIntPipe, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from "@nestjs/swagger";
import { AiInsightsService } from "./ai-insights.service";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UserRole } from "../common/enums/roles.enum";
import {
  StudentAiInsightQueryDto,
  DashboardAiInsightQueryDto,
} from "./dto/ai-insight-query.dto";

@ApiTags("AI Insights")
@Controller("ai-insights")
@ApiBearerAuth()
export class AiInsightsController {
  constructor(private aiInsightsService: AiInsightsService) {}

  @Post("students/:studentId")
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: "Generar insight con IA para un alumno" })
  @ApiOkResponse({ description: "Insight generado exitosamente." })
  @ApiNotFoundResponse({ description: "Alumno no encontrado." })
  @ApiForbiddenResponse({ description: "Sin permiso para ver este alumno." })
  async generateStudentInsight(
    @Param("studentId", ParseIntPipe) studentId: number,
    @CurrentUser() user: { id: number; role: UserRole },
    @Query() query: StudentAiInsightQueryDto,
  ) {
    return this.aiInsightsService.generateStudentInsight(
      studentId,
      user,
      query.period,
    );
  }

  @Post("dashboard")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Generar insight con IA para el dashboard" })
  @ApiOkResponse({ description: "Insight de dashboard generado exitosamente." })
  @ApiForbiddenResponse({ description: "Sin permiso para ver el dashboard." })
  async generateDashboardInsight(
    @CurrentUser() user: { id: number; role: UserRole },
    @Query() query: DashboardAiInsightQueryDto,
  ) {
    return this.aiInsightsService.generateDashboardInsight(
      user,
      query.period,
      query.groupId,
    );
  }
}
