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

    const {
      phone,
      employeeId,
      enrollmentId,
      specialty,
      address,
      groupId,
      parentId,
      ...userData
    } = updateUserDto as any;
    const data: any = { ...userData };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    const profileUpdate: any = {};

    if (phone !== undefined) {
      profileUpdate.phone = phone || null;
    }

    if (user.role === UserRole.TEACHER) {
      if (employeeId !== undefined) profileUpdate.employeeId = employeeId;
      if (specialty !== undefined) profileUpdate.specialty = specialty;
    }

    if (user.role === UserRole.STUDENT) {
      if (enrollmentId !== undefined) profileUpdate.enrollmentId = enrollmentId;
      if (groupId !== undefined) profileUpdate.groupId = groupId;
      if (parentId !== undefined) profileUpdate.parentId = parentId;
    }

    if (user.role === UserRole.PARENT && address !== undefined) {
      profileUpdate.address = address;
    }

    if (Object.keys(profileUpdate).length > 0) {
      if (user.role === UserRole.ADMIN) {
        data.adminProfile = { update: profileUpdate };
      } else if (user.role === UserRole.TEACHER) {
        data.teacherProfile = { update: profileUpdate };
      } else if (user.role === UserRole.STUDENT) {
        data.studentProfile = { update: profileUpdate };
      } else if (user.role === UserRole.PARENT) {
        data.parentProfile = { update: profileUpdate };
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

  async updateProfile(userId: number, dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException("El correo electrónico ya está en uso");
      }
    }

    const userData: any = {};
    if (dto.firstName) userData.firstName = dto.firstName;
    if (dto.lastName) userData.lastName = dto.lastName;
    if (dto.email) userData.email = dto.email;
    if (dto.password) {
      userData.password = await bcrypt.hash(dto.password, 12);
    }

    // Actualizar campos de User
    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    // Actualizar teléfono en el perfil correspondiente si viene en el DTO
    if (dto.phone !== undefined) {
      switch (user.role) {
        case UserRole.ADMIN:
          await this.prisma.adminProfile.update({
            where: { userId },
            data: { phone: dto.phone },
          });
          break;
        case UserRole.TEACHER:
          await this.prisma.teacherProfile.update({
            where: { userId },
            data: { phone: dto.phone },
          });
          break;
        case UserRole.STUDENT:
          await this.prisma.studentProfile.update({
            where: { userId },
            data: { phone: dto.phone },
          });
          break;
        case UserRole.PARENT:
          await this.prisma.parentProfile.update({
            where: { userId },
            data: { phone: dto.phone },
          });
          break;
      }
    }

    return { message: "Perfil actualizado exitosamente" };
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

  async findTeachers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.TEACHER, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        teacherProfile: true,
      },
      orderBy: { lastName: "asc" },
    });
  }

  async findStudents(currentUser: { id: number; role: UserRole }) {
    const studentSelect = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
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
    };

    switch (currentUser.role) {
      case UserRole.ADMIN:
        return this.prisma.user.findMany({
          where: { role: UserRole.STUDENT, isActive: true },
          select: studentSelect,
          orderBy: { lastName: "asc" },
        });

      case UserRole.STUDENT:
        return this.prisma.user.findMany({
          where: { id: currentUser.id, role: UserRole.STUDENT },
          select: studentSelect,
          orderBy: { lastName: "asc" },
        });

      case UserRole.PARENT: {
        const parent = await this.prisma.parentProfile.findUnique({
          where: { userId: currentUser.id },
        });

        if (!parent) {
          return [];
        }

        return this.prisma.user.findMany({
          where: {
            role: UserRole.STUDENT,
            isActive: true,
            studentProfile: { parentId: parent.id },
          },
          select: studentSelect,
          orderBy: { lastName: "asc" },
        });
      }

      case UserRole.TEACHER: {
        const teacher = await this.prisma.teacherProfile.findUnique({
          where: { userId: currentUser.id },
        });

        if (!teacher) {
          return [];
        }

        const classes = await this.prisma.class.findMany({
          where: { teacherId: teacher.id },
          select: { groupId: true },
          distinct: ["groupId"],
        });

        const groupIds = classes.map((c) => c.groupId);

        if (groupIds.length === 0) {
          return [];
        }

        return this.prisma.user.findMany({
          where: {
            role: UserRole.STUDENT,
            isActive: true,
            studentProfile: { groupId: { in: groupIds } },
          },
          select: studentSelect,
          orderBy: { lastName: "asc" },
        });
      }

      default:
        return [];
    }
  }

  async exportStudentsCsv() {
    const students = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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
      },
      orderBy: { lastName: "asc" },
    });

    const sep = "sep=,\n";
    const header =
      "ID,Nombre,Apellidos,Correo,Matrícula,Grupo,Semáforo,Tutor,Correo Tutor\n";
    const rows = students.map((u: any) => {
      const sp = u.studentProfile;
      const firstName = `"${u.firstName || ""}"`;
      const lastName = `"${u.lastName || ""}"`;
      const email = `"${u.email || ""}"`;
      const enrollmentId = `"${sp?.enrollmentId || ""}"`;
      const groupName = `"${sp?.group?.name || ""}"`;
      const semaphore = `"${sp?.semaphore || "GREEN"}"`;
      const parentName = sp?.parent?.user
        ? `"${sp.parent.user.firstName || ""} ${sp.parent.user.lastName || ""}"`
        : '""';
      const parentEmail = sp?.parent?.user?.email
        ? `"${sp.parent.user.email}"`
        : '""';
      return `${u.id},${firstName},${lastName},${email},${enrollmentId},${groupName},${semaphore},${parentName},${parentEmail}`;
    });

    const csvString = sep + header + rows.join("\n");
    return Buffer.from(csvString, "latin1");
  }

  async assignParentToStudent(studentId: number, parentId: number) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    const parent = await this.prisma.parentProfile.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException("Tutor no encontrado");
    }

    const updated = await this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { parentId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        group: true,
        parent: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    return {
      message: "Tutor asignado correctamente al estudiante",
      student: updated,
    };
  }

  async getStudentParentInfo(studentId: number) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        group: true,
        parent: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    return student;
  }

  async findAllParents() {
    return this.prisma.parentProfile.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        children: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            group: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
  }
}
