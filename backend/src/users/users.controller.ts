import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/roles.enum";

@ApiTags("Usuarios")
@Controller("users")
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Listar todos los usuarios" })
  @ApiQuery({ name: "role", required: false, enum: UserRole })
  @ApiOkResponse({
    description: "Listado de usuarios recuperado exitosamente.",
  })
  async findAll(@Query("role") role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Obtener usuario por ID" })
  @ApiOkResponse({ description: "Usuario encontrado." })
  @ApiNotFoundResponse({ description: "Usuario no encontrado." })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Crear nuevo usuario" })
  @ApiCreatedResponse({
    description: "Usuario creado y perfil asociado inicializado.",
  })
  @ApiBadRequestResponse({
    description: "Error de validación o correo duplicado.",
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Actualizar usuario" })
  @ApiOkResponse({ description: "Usuario actualizado exitosamente." })
  @ApiNotFoundResponse({ description: "Usuario no encontrado." })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar usuario" })
  @ApiOkResponse({ description: "Usuario eliminado correctamente." })
  @ApiNotFoundResponse({ description: "Usuario no encontrado." })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
