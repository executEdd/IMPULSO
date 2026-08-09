import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseIntPipe,
} from "@nestjs/common";
import { Response } from "express";
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

  @Get("export/students/csv")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Exportar padrón de alumnos con semáforo a CSV" })
  async exportStudentsCsv(@Res() res: Response) {
    const csvContent = await this.usersService.exportStudentsCsv();
    res.setHeader("Content-Type", "text/csv; charset=latin1");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="padron_alumnos_${Date.now()}.csv"`,
    );
    return res.end(csvContent);
  }

  @Get("parents")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: "Listar todos los perfiles de tutores/padres" })
  @ApiOkResponse({ description: "Listado de tutores recuperado exitosamente." })
  async findAllParents() {
    return this.usersService.findAllParents();
  }

  @Get("students/:studentId/parent-info")
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Obtener la ficha completa del alumno con información de su tutor",
  })
  @ApiOkResponse({ description: "Ficha del alumno y tutor recuperada." })
  @ApiNotFoundResponse({ description: "Alumno no encontrado." })
  async getStudentParentInfo(
    @Param("studentId", ParseIntPipe) studentId: number,
  ) {
    return this.usersService.getStudentParentInfo(studentId);
  }

  @Put("students/:studentId/parent/:parentId")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Vincular o actualizar el tutor asignado a un estudiante",
  })
  @ApiOkResponse({ description: "Tutor asignado correctamente." })
  @ApiNotFoundResponse({ description: "Alumno o tutor no encontrado." })
  async assignParentToStudent(
    @Param("studentId", ParseIntPipe) studentId: number,
    @Param("parentId", ParseIntPipe) parentId: number,
  ) {
    return this.usersService.assignParentToStudent(studentId, parentId);
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
