import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiUnauthorizedResponse, ApiConflictResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiCreatedResponse({ description: 'Inicio de sesión exitoso. Retorna el JWT y datos básicos del usuario.' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas.' })
  async login(@Body() loginDto: LoginDto) {
    console.log('[AuthController] Recibida petición de login:', loginDto.email);
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiCreatedResponse({ description: 'Usuario registrado exitosamente.' })
  @ApiConflictResponse({ description: 'El correo electrónico ya está registrado.' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiOkResponse({ description: 'Perfil completo del usuario autenticado (incluye información de roles, grupo y tutor si aplica).' })
  @ApiUnauthorizedResponse({ description: 'Token inválido o usuario no encontrado.' })
  async getProfile(@CurrentUser('id') userId: number) {
    return this.authService.getProfile(userId);
  }
}
