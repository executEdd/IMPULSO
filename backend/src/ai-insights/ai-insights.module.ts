import { Module } from "@nestjs/common";
import { AiInsightsController } from "./ai-insights.controller";
import { AiInsightsService } from "./ai-insights.service";
import { InsightsModule } from "../insights/insights.module";

@Module({
  imports: [InsightsModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
  exports: [AiInsightsService],
})
export class AiInsightsModule {}
