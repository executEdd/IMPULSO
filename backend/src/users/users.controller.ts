import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/roles.enum';

@ApiTags('Usuarios')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos los usuarios' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  async findAll(@Query('role') role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar usuario' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar usuario' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Get('role/:role')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Listar usuarios por rol' })
  async findByRole(@Param('role') role: UserRole) {
    return this.usersService.findByRole(role);
  }
}
