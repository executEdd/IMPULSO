import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Manejo específico de excepciones de Prisma (Base de datos)
      switch (exception.code) {
        case "P2002": {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[])?.join(", ") || "campo";
          message = {
            statusCode: status,
            error: "Conflict",
            message: `El valor ingresado para el campo '${target}' ya está registrado (duplicado).`,
          };
          break;
        }
        case "P2003": {
          status = HttpStatus.CONFLICT;
          message = {
            statusCode: status,
            error: "Conflict",
            message: "Error de relación: la operación no se pudo completar porque existen dependencias activas o el registro relacionado no existe.",
          };
          break;
        }
        case "P2025": {
          status = HttpStatus.NOT_FOUND;
          message = {
            statusCode: status,
            error: "Not Found",
            message: "El registro solicitado no existe o no pudo ser encontrado.",
          };
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = {
            statusCode: status,
            error: "Bad Request",
            message: `Error de base de datos (${exception.code}): Operación no permitida.`,
          };
          break;
        }
      }
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${JSON.stringify(message)}`,
      stack,
    );

    response.status(status).json(
      typeof message === "object" && message !== null
        ? {
            timestamp: new Date().toISOString(),
            path: request.url,
            ...message,
          }
        : {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
          }
    );
  }
}
