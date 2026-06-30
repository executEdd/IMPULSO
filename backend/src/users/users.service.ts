import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserRole } from "../common/enums/roles.enum";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(role?: UserRole) {
    const where = role ? { role } : {};
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        adminProfile: true,
        teacherProfile: true,
        studentProfile: {
          include: { group: true },
        },
        parentProfile: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        adminProfile: true,
        teacherProfile: true,
        studentProfile: {
          include: {
            group: true,
            parent: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
        parentProfile: {
          include: {
            children: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                group: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException("El correo electrónico ya está registrado");
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    const {
      role,
      employeeId,
      enrollmentId,
      phone,
      specialty,
      groupId,
      parentId,
      ...userData
    } = createUserDto;
    delete (userData as any).password;

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        role,
        ...(role === UserRole.ADMIN && {
          adminProfile: {
            create: { position: "Administrador", phone: phone || "" },
          },
        }),
        ...(role === UserRole.TEACHER && {
          teacherProfile: {
            create: {
              employeeId: employeeId || `EMP-${Date.now()}`,
              specialty: specialty || "",
              phone: phone || "",
            },
          },
        }),
        ...(role === UserRole.STUDENT && {
          studentProfile: {
            create: {
              enrollmentId: enrollmentId || `ENR-${Date.now()}`,
              groupId: groupId || 1,
              parentId: parentId || 1,
              phone: phone || null,
            },
          },
        }),
        ...(role === UserRole.PARENT && {
          parentProfile: {
            create: {
              phone: phone || "",
            },
          },
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        adminProfile: true,
        teacherProfile: true,
        studentProfile: true,
        parentProfile: true,
      },
    });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const { phone, ...userData } = updateUserDto as any;
    const data: any = { ...userData };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    if (phone !== undefined) {
      if (user.role === UserRole.ADMIN) {
        data.adminProfile = { update: { phone: phone || null } };
      } else if (user.role === UserRole.TEACHER) {
        data.teacherProfile = { update: { phone: phone || null } };
      } else if (user.role === UserRole.STUDENT) {
        data.studentProfile = { update: { phone: phone || null } };
      } else if (user.role === UserRole.PARENT) {
        data.parentProfile = { update: { phone: phone || "" } };
      }
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: "Usuario eliminado exitosamente" };
  }

  async findByRole(role: UserRole) {
    return this.prisma.user.findMany({
      where: { role, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        teacherProfile: role === UserRole.TEACHER,
        studentProfile:
          role === UserRole.STUDENT ? { include: { group: true } } : false,
        parentProfile: role === UserRole.PARENT,
      },
    });
  }
}
