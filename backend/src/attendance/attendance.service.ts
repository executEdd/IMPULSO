import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import {
  AttendanceStatus,
  SemaphoreStatus,
  AlertType,
  AlertPriority,
  DayOfWeek,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { QrScanDto } from "./dto/qr-scan.dto";

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async verifyStudentAccess(user: any, studentId: number) {
    if (user.role === "ADMIN" || user.role === "TEACHER") {
      return;
    }
    if (user.role === "STUDENT") {
      if (user.studentProfile?.id !== studentId) {
        throw new ForbiddenException(
          "No autorizado para acceder a este alumno",
        );
      }
      return;
    }
    if (user.role === "PARENT") {
      if (!user.parentProfile) {
        throw new ForbiddenException(
          "No autorizado: Perfil de tutor no encontrado",
        );
      }
      const child = await this.prisma.studentProfile.findFirst({
        where: {
          id: studentId,
          parentId: user.parentProfile.id,
        },
      });
      if (!child) {
        throw new ForbiddenException(
          "No autorizado para acceder a este alumno (no es su tutorado)",
        );
      }
      return;
    }
    throw new ForbiddenException("Rol no reconocido");
  }

  private getMexicoCityTimeInfo(date: Date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      weekday: "long",
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }

    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10);
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);

    const weekdayMap: Record<string, DayOfWeek> = {
      Monday: DayOfWeek.MONDAY,
      Tuesday: DayOfWeek.TUESDAY,
      Wednesday: DayOfWeek.WEDNESDAY,
      Thursday: DayOfWeek.THURSDAY,
      Friday: DayOfWeek.FRIDAY,
      Saturday: DayOfWeek.SATURDAY,
      Sunday: DayOfWeek.SUNDAY,
    };

    const currentDay = weekdayMap[partMap.weekday] || DayOfWeek.MONDAY;
    const currentTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

    const todayStart = new Date(Date.UTC(year, month - 1, day, 6, 0, 0));
    const todayEnd = new Date(Date.UTC(year, month - 1, day, 29, 59, 59, 999));

    return {
      currentTime,
      currentDay,
      todayStart,
      todayEnd,
    };
  }

  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private isWithinTimeRange(
    currentTime: string,
    startTime: string,
    endTime: string,
  ): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    return current >= start && current <= end;
  }

  async scanQr(qrScanDto: QrScanDto, teacherId: number) {
    const now = new Date();
    const { currentTime, currentDay, todayStart, todayEnd } =
      this.getMexicoCityTimeInfo(now);

    // 1. Buscar estudiante por token QR
    const student = await this.prisma.studentProfile.findUnique({
      where: { qrToken: qrScanDto.qrToken },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        group: true,
        parent: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                id: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new BadRequestException("Token QR inválido o expirado");
    }

    // 2. Verificar que el token no haya expirado
    if (student.qrExpiresAt && now > student.qrExpiresAt) {
      throw new BadRequestException(
        "El token QR ha expirado. El alumno debe refrescar su credencial digital.",
      );
    }

    // 3. Obtener el horario y validar que el docente sea el asignado
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: qrScanDto.scheduleId },
      include: {
        subject: true,
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        group: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario no encontrado");
    }

    // 4. Validar que el docente que escanea sea el asignado a la clase
    if (schedule.teacherId !== teacherId) {
      throw new BadRequestException(
        "No está autorizado para registrar asistencia en esta clase. El docente no coincide con el horario asignado.",
      );
    }

    // 5. Validar día de la semana
    if (schedule.dayOfWeek !== currentDay) {
      throw new BadRequestException(
        `Inconsistencia de día: La clase está programada para ${schedule.dayOfWeek}, pero hoy es ${currentDay}`,
      );
    }

    // 6. Validar hora
    if (
      !this.isWithinTimeRange(currentTime, schedule.startTime, schedule.endTime)
    ) {
      throw new BadRequestException(
        `Inconsistencia de horario: La clase es de ${schedule.startTime} a ${schedule.endTime}. Hora actual: ${currentTime}`,
      );
    }

    // 7. Validar que el alumno pertenezca al grupo de la clase
    if (student.groupId !== schedule.groupId) {
      throw new BadRequestException(
        `Inconsistencia de grupo: El alumno ${student.user.firstName} ${student.user.lastName} pertenece al grupo ${student.group.name}, pero esta clase es del grupo ${schedule.group.name}`,
      );
    }

    // 9. Registrar asistencia y limpiar el QR token en una transacción
    return this.prisma.$transaction(async (tx) => {
      // 8. Verificar que no haya asistencia duplicada para hoy dentro de la transacción
      const existingAttendance = await tx.attendance.findFirst({
        where: {
          studentId: student.id,
          scheduleId: schedule.id,
          date: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
      });

      if (existingAttendance) {
        throw new BadRequestException(
          "La asistencia de este alumno ya fue registrada para esta clase hoy",
        );
      }
      await tx.studentProfile.update({
        where: { id: student.id },
        data: {
          qrToken: null,
          qrExpiresAt: null,
        },
      });

      const attendance = await tx.attendance.create({
        data: {
          studentId: student.id,
          scheduleId: schedule.id,
          status: AttendanceStatus.PRESENT,
          qrToken: qrScanDto.qrToken,
          notes: `Registrado por QR a las ${currentTime}`,
        },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              group: true,
            },
          },
          schedule: {
            include: {
              subject: true,
            },
          },
        },
      });

      return {
        success: true,
        message: `Asistencia registrada exitosamente para ${student.user.firstName} ${student.user.lastName}`,
        attendance: {
          id: attendance.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          group: student.group.name,
          subject: schedule.subject.name,
          time: `${schedule.startTime} - ${schedule.endTime}`,
          status: attendance.status,
          date: attendance.date,
        },
      };
    });
  }

  async markAbsent(studentId: number, scheduleId: number, teacherId: number) {
    const now = new Date();
    const { currentTime, currentDay, todayStart, todayEnd } =
      this.getMexicoCityTimeInfo(now);

    // Validar horario y docente
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        subject: true,
        group: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario no encontrado");
    }

    if (schedule.teacherId !== teacherId) {
      throw new BadRequestException("No autorizado para esta clase");
    }

    if (schedule.dayOfWeek !== currentDay) {
      throw new BadRequestException("Día no coincide con el horario");
    }

    // Verificar que el alumno pertenezca al grupo
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
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

    if (student.groupId !== schedule.groupId) {
      throw new BadRequestException("El alumno no pertenece a este grupo");
    }

    // Envolver todo en la misma transacción (Finding 4)
    return this.prisma.$transaction(async (tx) => {
      // Verificar duplicado dentro de la transacción
      const existing = await tx.attendance.findFirst({
        where: {
          studentId,
          scheduleId,
          date: { gte: todayStart, lt: todayEnd },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "Ya existe un registro para este alumno hoy",
        );
      }
      // Registrar falta
      const attendance = await tx.attendance.create({
        data: {
          studentId,
          scheduleId,
          status: AttendanceStatus.ABSENT,
          notes: `Falta registrada manualmente por docente a las ${currentTime}`,
        },
      });

      // MOTOR DE ALERTAS: Verificar regla de las 3 faltas
      await this.checkAndTriggerAttendanceAlert(studentId, student, tx);

      return {
        success: true,
        message: `Falta registrada para ${student.user.firstName} ${student.user.lastName}`,
        attendance,
      };
    });
  }

  private async checkAndTriggerAttendanceAlert(
    studentId: number,
    student: any,
    tx?: any,
  ) {
    const client = tx || this.prisma;

    // Contar faltas del periodo actual (últimos 30 días como periodo de referencia)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const absencesCount = await client.attendance.count({
      where: {
        studentId,
        status: AttendanceStatus.ABSENT,
        date: { gte: thirtyDaysAgo },
      },
    });

    // Si alcanza 3 faltas, activar semáforo rojo y alertas
    if (absencesCount >= 3) {
      // 1. Check if student semaphore is already RED (Finding 9: alert flooding)
      const currentStudentProfile = await client.studentProfile.findUnique({
        where: { id: studentId },
        select: { semaphore: true },
      });

      if (currentStudentProfile?.semaphore === SemaphoreStatus.RED) {
        return;
      }

      // Optimizamos: Obtenemos los administradores antes de abrir la transacción
      const admins = await client.user.findMany({
        where: { role: "ADMIN", isActive: true },
      });

      // 2. Actualizar semáforo a ROJO
      await client.studentProfile.update({
        where: { id: studentId },
        data: { semaphore: SemaphoreStatus.RED },
      });

      // 3. Crear alerta prioritaria
      const alert = await client.alert.create({
        data: {
          studentId,
          type: AlertType.ATTENDANCE,
          priority: AlertPriority.CRITICAL,
          message: `ALERTA CRÍTICA: El alumno ${student.user.firstName} ${student.user.lastName} ha acumulado ${absencesCount} faltas. Se activa Semáforo Rojo.`,
        },
      });

      // 4. Enviar notificación al padre de familia (simulado)
      if (student.parent) {
        await client.notification.create({
          data: {
            alertId: alert.id,
            senderId: 1, // Sistema/Admin
            recipientType: "PARENT",
            recipientId: student.parent.user.id,
            channel: "EMAIL",
            status: "SENT",
            content: `Estimado padre/tutor de ${student.user.firstName} ${student.user.lastName}:

Le informamos que su hijo(a) ha acumulado ${absencesCount} faltas en el periodo actual. El sistema ha activado el Semáforo Rojo de alerta académica.

Por favor, comuníquese con la Subdirección Académica del CBTIS 61 para mayor información.

Grupo: ${student.group.name}
Fecha: ${new Date().toLocaleDateString("es-MX")}

CBTIS 61 - Sistema de Gestión Académica`,
            sentAt: new Date(),
          },
        });

        // Notificación SMS (simulada)
        await client.notification.create({
          data: {
            alertId: alert.id,
            senderId: 1,
            recipientType: "PARENT",
            recipientId: student.parent.user.id,
            channel: "SMS",
            status: "SENT",
            content: `CBTIS 61: Alerta de asistencia. Su hijo(a) ${student.user.firstName} tiene ${absencesCount} faltas. Semáforo Rojo activado. Contacte Subdirección.`,
            sentAt: new Date(),
          },
        });
      }

      // 5. Notificación a Subdirección (Admin)
      for (const admin of admins) {
        await client.notification.create({
          data: {
            alertId: alert.id,
            senderId: 1,
            recipientType: "ADMIN",
            recipientId: admin.id,
            channel: "IN_APP",
            status: "SENT",
            content: `Semáforo Rojo: ${student.user.firstName} ${student.user.lastName} (${student.group.name}) - ${absencesCount} faltas acumuladas.`,
            sentAt: new Date(),
          },
        });
      }
    }
  }

  async findAll(filters?: {
    studentId?: number;
    scheduleId?: number;
    date?: Date;
  }) {
    const where: any = {};
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.scheduleId) where.scheduleId = filters.scheduleId;
    if (filters?.date) {
      const { todayStart, todayEnd } = this.getMexicoCityTimeInfo(filters.date);
      where.date = { gte: todayStart, lt: todayEnd };
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            group: true,
          },
        },
        schedule: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  async findByStudent(studentId: number) {
    return this.prisma.attendance.findMany({
      where: { studentId },
      include: {
        schedule: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  async getStudentAbsenceCount(studentId: number) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const absences = await this.prisma.attendance.count({
      where: {
        studentId,
        status: AttendanceStatus.ABSENT,
        date: { gte: thirtyDaysAgo },
      },
    });

    const totalClasses = await this.prisma.attendance.count({
      where: {
        studentId,
        date: { gte: thirtyDaysAgo },
      },
    });

    return {
      absences,
      totalClasses,
      attendanceRate:
        totalClasses > 0
          ? (((totalClasses - absences) / totalClasses) * 100).toFixed(2)
          : "0.00",
    };
  }

  async getRedSemaphoreStudents() {
    return this.prisma.studentProfile.findMany({
      where: { semaphore: SemaphoreStatus.RED },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        group: true,
        parent: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        attendances: {
          where: { status: AttendanceStatus.ABSENT },
          orderBy: { date: "desc" },
          take: 10,
          include: {
            schedule: { include: { subject: true } },
          },
        },
      },
    });
  }

  async resetSemaphore(studentId: number) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    const updated = await this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { semaphore: SemaphoreStatus.GREEN },
    });

    return {
      success: true,
      message: "Semáforo restablecido a VERDE para el alumno",
      student: updated,
    };
  }
}
