import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Seguridad
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());

  // CORS - Configuración segura
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  app.enableCors({
    origin: process.env.NODE_ENV === "production" ? frontendUrl : true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Filtros globales
  app.useGlobalFilters(new HttpExceptionFilter());

  // Prefijo global
  app.setGlobalPrefix("api");

  // Swagger Documentation - Solo en desarrollo
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("CBTIS 61 - Sistema de Gestión Académica")
      .setDescription(
        "API RESTful para el Sistema de Gestión Académica y Seguimiento de Alumnos del CBTIS 61",
      )
      .setVersion("1.0.0")
      .addBearerAuth()
      .addTag("Autenticación")
      .addTag("Usuarios")
      .addTag("Asistencias")
      .addTag("Horarios")
      .addTag("Calificaciones")
      .addTag("Notificaciones")
      .addTag("QR Digital")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Servidor ,corriendo en: http://localhost:${port}/api`);
}

bootstrap();
