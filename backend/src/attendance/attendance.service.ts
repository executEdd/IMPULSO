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
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { QrScanDto } from "./dto/qr-scan.dto";

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private getMexicoCityTimeInfo(date: Date) {
    const formattedDateStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);

    const match = formattedDateStr.match(
      /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/,
    );
    if (!match) {
      throw new Error("Error al formatear la fecha para America/Mexico_City");
    }

    const [, month, day, year, hours, minutes] = match;

    const localYear = parseInt(year);
    const localMonth = parseInt(month) - 1;
    const localDay = parseInt(day);

    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    const tempDate = new Date(localYear, localMonth, localDay);
    const currentDay = days[tempDate.getDay()];

    const currentTime = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;

    const todayStart = new Date(
      Date.UTC(localYear, localMonth, localDay, 0, 0, 0, 0),
    );
    const todayEnd = new Date(
      Date.UTC(localYear, localMonth, localDay, 23, 59, 59, 999),
    );

    // Ajustar offsets para UTC en base a huso horario de CDMX (-6)
    todayStart.setUTCHours(todayStart.getUTCHours() + 6);
    todayEnd.setUTCHours(todayEnd.getUTCHours() + 6);

    return {
      currentTime,
      currentDay,
      todayStart,
      todayEnd,
    };
  }

  private isWithinTimeRange(
    currentTime: string,
    startTime: string,
    endTime: string,
  ): boolean {
    const [currH, currM] = currentTime.split(":").map(Number);
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const current = currH * 60 + currM;
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;

    return current >= start - 15 && current <= end + 15;
  }

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
          "No autorizado para acceder a este alumno",
        );
      }
      return;
    }
    throw new ForbiddenException("Rol no reconocido");
  }

  async scanQr(qrScanDto: QrScanDto, teacherId: number) {
    const now = new Date();
    const { currentTime, currentDay, todayStart, todayEnd } =
      this.getMexicoCityTimeInfo(now);

    // 1. Buscar al alumno por su token QR
    const student = await this.prisma.studentProfile.findUnique({
      where: { qrToken: qrScanDto.qrToken },
      include: {
        user: { select: { firstName: true, lastName: true } },
        group: true,
        parent: {
          include: {
            user: {
              select: {
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

    // 3. Obtener el bloque de horario
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id: qrScanDto.classScheduleId },
      include: {
        class: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            group: true,
            classroom: true,
          },
        },
        classroom: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario de clase no encontrado");
    }

    // 4. Validar que el docente que escanea sea el asignado a la clase
    if (schedule.class.teacherId !== teacherId) {
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
    if (student.groupId !== schedule.class.groupId) {
      throw new BadRequestException(
        `Inconsistencia de grupo: El alumno ${student.user.firstName} ${student.user.lastName} pertenece al grupo ${student.group.name}, pero esta clase es del grupo ${schedule.class.group.name}`,
      );
    }

    // 9. Registrar asistencia y limpiar el QR token en una transacción
    return this.prisma.$transaction(async (tx) => {
      // 8. Verificar que no haya asistencia duplicada para hoy dentro de la transacción
      const existingAttendance = await tx.attendance.findFirst({
        where: {
          studentId: student.id,
          classScheduleId: qrScanDto.classScheduleId,
          date: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
      });

      if (existingAttendance) {
        throw new BadRequestException(
          "La asistencia de este alumno ya fue registrada para este bloque de clase hoy",
        );
      }
      await tx.studentProfile.update({
        where: { id: student.id },
        data: {
          qrToken: null,
          qrExpiresAt: null,
        },
      });

      return tx.attendance.create({
        data: {
          studentId: student.id,
          classId: schedule.class.id,
          classScheduleId: schedule.id,
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
          classes: {
            include: {
              subject: true,
            },
          },
        },
      });
    });
  }

  async markAbsent(
    studentId: number,
    classScheduleId: number,
    teacherId: number,
  ) {
    const now = new Date();
    const { currentTime, currentDay, todayStart, todayEnd } =
      this.getMexicoCityTimeInfo(now);

    // Validar horario y docente
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id: classScheduleId },
      include: {
        class: {
          include: {
            subject: true,
            group: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario de clase no encontrado");
    }

    if (schedule.class.teacherId !== teacherId) {
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

    if (student.groupId !== schedule.class.groupId) {
      throw new BadRequestException("El alumno no pertenece a este grupo");
    }

    return this.prisma.$transaction(async (tx) => {
      // Verificar duplicado dentro de la transacción
      const existing = await tx.attendance.findFirst({
        where: {
          studentId,
          classScheduleId: classScheduleId,
          date: { gte: todayStart, lt: todayEnd },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "Ya existe un registro de asistencia para este alumno en este bloque hoy",
        );
      }
      // Registrar falta
      const attendance = await tx.attendance.create({
        data: {
          studentId,
          classId: schedule.class.id,
          classScheduleId: schedule.id,
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
      const currentStudentProfile = await client.studentProfile.findUnique({
        where: { id: studentId },
        select: { semaphore: true },
      });

      if (currentStudentProfile?.semaphore === SemaphoreStatus.RED) {
        return;
      }

      const admins = await client.user.findMany({
        where: { role: "ADMIN", isActive: true },
      });

      // Actualizar semáforo a ROJO
      await client.studentProfile.update({
        where: { id: studentId },
        data: { semaphore: SemaphoreStatus.RED },
      });

      // Crear alerta prioritaria
      const alert = await client.alert.create({
        data: {
          studentId,
          type: AlertType.ATTENDANCE,
          priority: AlertPriority.CRITICAL,
          message: `ALERTA CRÍTICA: El alumno ${student.user.firstName} ${student.user.lastName} ha acumulado ${absencesCount} faltas. Se activa Semáforo Rojo.`,
        },
      });

      // Enviar notificación al padre de familia (simulado)
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

      // Notificación a Subdirección (Admin)
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
    classId?: number;
    classScheduleId?: number;
    date?: Date;
  }) {
    const where: any = {};
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.classScheduleId) {
      where.classes = {
        schedules: {
          some: {
            id: filters.classScheduleId,
          },
        },
      };
    }
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
        classes: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            schedules: true,
            classroom: true,
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
        classes: {
          include: {
            subject: true,
            schedules: true,
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
            classes: {
              include: {
                subject: true,
                schedules: true,
              },
            },
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

  async exportCsv(filters?: { studentId?: number; classId?: number }) {
    const records = await this.findAll(filters);
    const header = "ID,Fecha,Alumno,Matrícula,Grupo,Materia,Estado,Notas\n";
    const rows = records.map((r: any) => {
      const dateStr = r.date ? new Date(r.date).toISOString().split("T")[0] : "";
      const studentName = `"${r.student?.user?.firstName || ""} ${r.student?.user?.lastName || ""}"`;
      const enrollmentId = `"${r.student?.enrollmentId || ""}"`;
      const groupName = `"${r.student?.group?.name || ""}"`;
      const subjectName = `"${r.classes?.subject?.name || ""}"`;
      const status = `"${r.status}"`;
      const notes = `"${(r.notes || "").replace(/"/g, '""')}"`;
      return `${r.id},${dateStr},${studentName},${enrollmentId},${groupName},${subjectName},${status},${notes}`;
    });

    return "\uFEFF" + header + rows.join("\n");
  }
}
