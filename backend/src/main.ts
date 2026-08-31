import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  const isProduction = process.env.NODE_ENV === "production";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";
  const allowedOrigins = frontendUrl.split(",").map((o) => o.trim());

  // Health-check endpoint con CORS permisivo para monitoreo externo (UptimeRobot, etc.)
  const prisma = app.get(PrismaService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const healthPaths = [
      "/auth/health",
      "/api/auth/health",
      "/health",
      "/api/health",
    ];
    if (!healthPaths.includes(req.path)) {
      return next();
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      prisma.$queryRaw`SELECT 1`
        .then(() =>
          res.json({
            status: "ok",
            database: "connected",
            timestamp: new Date(),
          }),
        )
        .catch((error: any) =>
          res.status(503).json({
            status: "error",
            database: "disconnected",
            error: error.message,
            timestamp: new Date(),
          }),
        );
      return;
    }

    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const isVercelDeployment = !!origin && origin.endsWith(".vercel.app");

      if (
        (!origin && !isProduction) ||
        (!!origin && allowedOrigins.indexOf(origin) !== -1) ||
        isVercelDeployment ||
        origin?.startsWith("http://localhost:") ||
        origin === "https://localhost" ||
        origin === "capacitor://localhost"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.setGlobalPrefix("api");

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
      .addTag("Push Notifications")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Servidor corriendo en: http://localhost:${port}/api`);
}

bootstrap();
