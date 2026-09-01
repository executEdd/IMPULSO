import { Controller, Post, Body, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

const ACCESS_TOKEN_COOKIE = "access_token";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@ApiTags("AutenticaciÃ³n")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000, blockDuration: 300000 } })
  @Post("login")
  @ApiOperation({ summary: "Iniciar sesiÃ³n" })
  @ApiCreatedResponse({
    description:
      "Inicio de sesiÃ³n exitoso. El JWT se establece como cookie httpOnly.",
  })
  @ApiUnauthorizedResponse({ description: "Credenciales invÃ¡lidas." })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.login(loginDto);

    const maxAge = loginDto.rememberMe ? 15 * ONE_DAY_MS : ONE_DAY_MS;

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge,
    });

    return { accessToken, user };
  }

  @Post("logout")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cerrar sesiÃ³n" })
  @ApiOkResponse({ description: "SesiÃ³n cerrada exitosamente." })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return { message: "SesiÃ³n cerrada exitosamente" };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000, blockDuration: 300000 } })
  @Post("register")
  @ApiOperation({ summary: "Registrar nuevo usuario" })
  @ApiCreatedResponse({ description: "Usuario registrado exitosamente." })
  @ApiConflictResponse({
    description: "El correo electrÃ³nico ya estÃ¡ registrado.",
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get("profile")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtener perfil del usuario autenticado" })
  @ApiOkResponse({
    description:
      "Perfil completo del usuario autenticado (incluye informaciÃ³n de roles, grupo y tutor si aplica).",
  })
  @ApiUnauthorizedResponse({
    description: "Token invÃ¡lido o usuario no encontrado.",
  })
  async getProfile(@CurrentUser("id") userId: number) {
    return this.authService.getProfile(userId);
  }

  @Public()
  @SkipThrottle()
  @Get("health")
  @ApiOperation({ summary: "Verificar estado del servidor y la base de datos" })
  async health() {
    return this.authService.checkHealth();
  }
}

