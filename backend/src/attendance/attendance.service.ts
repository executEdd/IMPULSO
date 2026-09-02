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
  Prisma,
  Semester,
  StudentProfile,
  User,
  Alert,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { NotificationRouterService } from "../notifications/notification-router.service";
import { QrScanDto } from "./dto/qr-scan.dto";
import { ManualAttendanceDto } from "./dto/manual-attendance.dto";
import { CreateAttendanceDto } from "./dto/create-attendance.dto";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";
import { UserRole } from "../common/enums/roles.enum";
import * as bcrypt from "bcryptjs";
import { QrService } from "../qr/qr.service";
import {
  IAuthenticatedUser,
  IStudentAttendanceStats,
  IMexicoCityTimeInfo,
  ISemaphoreSummaryResponse,
  IGroupSemaphoreSummary,
  AttendanceWithDetails,
} from "./interfaces";

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private notificationRouter: NotificationRouterService,
    private qrService: QrService,
  ) {}

  public getMexicoCityTimeInfo(date: Date): IMexicoCityTimeInfo {
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
    const tempDate = new Date(Date.UTC(localYear, localMonth, localDay));
    const currentDay = days[tempDate.getUTCDay()];

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

  async verifyStudentAccess(
    user: IAuthenticatedUser,
    studentId: number,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEACHER) {
      return;
    }
    if (user.role === UserRole.STUDENT) {
      if (user.studentProfile?.id !== studentId) {
        throw new ForbiddenException(
          "No autorizado para acceder a este alumno",
        );
      }
      return;
    }
    if (user.role === UserRole.PARENT) {
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

  private async resolveActiveSemester(
    tx?: Prisma.TransactionClient,
  ): Promise<Semester | null> {
    const client = tx || this.prisma;
    const now = new Date();

    const active = await client.semester.findFirst({
      where: {
        startDate: { lte: now },
        finishDate: { gte: now },
      },
      orderBy: { startDate: "desc" },
    });

    if (active) return active;

    return client.semester.findFirst({
      orderBy: { finishDate: "desc" },
    });
  }

  private async resolveSenderId(
    providedSenderId?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (providedSenderId) return providedSenderId;
    const client = tx || this.prisma;
    const admin = await client.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (admin) return admin.id;
    const fallback = await client.user.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return fallback?.id || 1;
  }

  public calculateAttendanceMetrics(
    attendances: Array<{ status: AttendanceStatus }>,
    currentSemester?: {
      id: number;
      semesterName: string;
      startDate: Date;
    } | null,
    todayEnd?: Date,
  ): IStudentAttendanceStats {
    let present = 0;
    let absent = 0;
    let late = 0;
    let justified = 0;

    for (const a of attendances) {
      switch (a.status) {
        case AttendanceStatus.PRESENT:
          present++;
          break;
        case AttendanceStatus.ABSENT:
          absent++;
          break;
        case AttendanceStatus.LATE:
          late++;
          break;
        case AttendanceStatus.JUSTIFIED:
          justified++;
          break;
      }
    }

    const totalClasses = attendances.length;
    const effectiveAbsences = absent + Math.floor(late / 3);
    const evaluableClasses = totalClasses - justified;

    const attendanceRate =
      evaluableClasses > 0
        ? Math.round(
            ((evaluableClasses - effectiveAbsences) / evaluableClasses) * 10000,
          ) / 100
        : 100.0;

    let semaphore: SemaphoreStatus;
    if (effectiveAbsences >= 3) {
      semaphore = SemaphoreStatus.RED;
    } else if (effectiveAbsences === 2 || attendanceRate < 80.0) {
      semaphore = SemaphoreStatus.YELLOW;
    } else {
      semaphore = SemaphoreStatus.GREEN;
    }

    return {
      absences: absent,
      present,
      late,
      justified,
      effectiveAbsences,
      totalClasses,
      attendanceRate,
      semaphore,
      evaluatedPeriod: {
        semesterId: currentSemester?.id ?? 0,
        semesterName: currentSemester?.semesterName ?? "N/A",
        startDate: currentSemester?.startDate ?? new Date(0),
        evaluatedUntil: todayEnd ?? new Date(),
      },
    };
  }

  async scanQr(qrScanDto: QrScanDto, teacherId: number) {
    // Si la app envió scannedAt (sync offline), usamos esa fecha. Si no, usamos la actual.
    const evaluationDate = qrScanDto.scannedAt
      ? new Date(qrScanDto.scannedAt)
      : new Date();

    // Verificamos que la fecha enviada sea válida
    if (isNaN(evaluationDate.getTime())) {
      throw new BadRequestException("La fecha scannedAt es inválida");
    }

    const { currentTime, currentDay, todayStart, todayEnd } =
      this.getMexicoCityTimeInfo(evaluationDate);

    // 1. Validar el token QR matemáticamente (stateless) para la fecha de escaneo
    const qrValidation = await this.qrService.validateQrToken(
      qrScanDto.qrToken,
      evaluationDate,
    );

    if (!qrValidation.valid || !qrValidation.studentId) {
      throw new BadRequestException(
        qrValidation.message || "Token QR inválido o expirado",
      );
    }

    // 2. Buscar al alumno validado
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: qrValidation.studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        group: true,
        parent: {
          include: {
            user: {
              select: { email: true, id: true },
            },
          },
        },
      },
    });

    if (!student) {
      throw new BadRequestException("Alumno no encontrado");
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
                user: { select: { id: true, firstName: true, lastName: true } },
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

    // 4. Validar que el docente que escanea sea el asignado a la clase (403 ForbiddenException)
    if (schedule.class.teacherId !== teacherId) {
      throw new ForbiddenException(
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

    const teacherUserId = schedule.class.teacher?.user?.id;

    // 8. Registrar asistencia y recalcular semáforo en transacción
    return this.prisma.$transaction(async (tx) => {
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

      const created = await tx.attendance.create({
        data: {
          studentId: student.id,
          classId: schedule.class.id,
          classScheduleId: schedule.id,
          date: evaluationDate,
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

      await this.recalculateStudentSemaphore(student.id, tx, teacherUserId);

      return created;
    });
  }

  async markPresentManual(
    dto: ManualAttendanceDto,
    userId: number,
    role: UserRole,
    teacherProfileId?: number,
  ) {
    const { studentId, classScheduleId, password } = dto;
    const now = new Date();
    const { currentTime, currentDay, todayStart, todayEnd } =
      this.getMexicoCityTimeInfo(now);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("Usuario no encontrado");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      throw new BadRequestException(
        "Contraseña incorrecta. Confirmación fallida.",
      );

    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id: classScheduleId },
      include: {
        class: {
          include: {
            group: true,
            subject: true,
            teacher: { select: { userId: true } },
          },
        },
      },
    });

    if (!schedule)
      throw new NotFoundException("Horario de clase no encontrado");
    if (schedule.dayOfWeek !== currentDay)
      throw new BadRequestException("Día no coincide con el horario");

    if (
      role === UserRole.TEACHER &&
      schedule.class.teacherId !== teacherProfileId
    ) {
      throw new ForbiddenException(
        "No autorizado para modificar la asistencia de esta clase",
      );
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) throw new NotFoundException("Alumno no encontrado");
    if (student.groupId !== schedule.class.groupId)
      throw new BadRequestException("El alumno no pertenece a este grupo");

    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findFirst({
        where: {
          studentId,
          classScheduleId,
          date: { gte: todayStart, lt: todayEnd },
        },
      });

      if (existing) {
        throw new BadRequestException(
          "Ya existe un registro de asistencia para este alumno en este bloque hoy",
        );
      }

      const created = await tx.attendance.create({
        data: {
          studentId,
          classId: schedule.class.id,
          classScheduleId: schedule.id,
          status: AttendanceStatus.PRESENT,
          qrToken: null,
          notes: `Registrado manualmente por ${user.firstName} ${user.lastName} a las ${currentTime}`,
        },
        include: {
          student: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          classes: { include: { subject: true } },
        },
      });

      await this.recalculateStudentSemaphore(studentId, tx, userId);

      return created;
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
            teacher: { select: { userId: true } },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario de clase no encontrado");
    }

    if (schedule.class.teacherId !== teacherId) {
      throw new ForbiddenException(
        "No está autorizado para registrar asistencia en esta clase. El docente no coincide con el horario asignado.",
      );
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
      },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    if (student.groupId !== schedule.class.groupId) {
      throw new BadRequestException("El alumno no pertenece a este grupo");
    }

    const teacherUserId = schedule.class.teacher?.userId;

    const attendance = await this.prisma.$transaction(async (tx) => {
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
      const created = await tx.attendance.create({
        data: {
          studentId,
          classId: schedule.class.id,
          classScheduleId: schedule.id,
          status: AttendanceStatus.ABSENT,
          notes: `Falta registrada manualmente por docente a las ${currentTime}`,
        },
      });

      // MOTOR DE ALERTAS: Recalcular semáforo
      await this.recalculateStudentSemaphore(studentId, tx, teacherUserId);

      return created;
    });

    return {
      success: true,
      message: `Falta registrada para ${student.user.firstName} ${student.user.lastName}`,
      attendance,
    };
  }

  async recalculateStudentSemaphore(
    studentId: number,
    tx?: Prisma.TransactionClient,
    senderId?: number,
  ): Promise<SemaphoreStatus> {
    const client = tx || this.prisma;

    const student = await client.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        group: { select: { id: true, name: true } },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException("Alumno no encontrado");
    }

    const previousSemaphore = student.semaphore;
    const stats = await this.getStudentAbsenceCount(studentId, client);
    const newSemaphore = stats.semaphore;

    if (previousSemaphore !== newSemaphore) {
      await client.studentProfile.update({
        where: { id: studentId },
        data: { semaphore: newSemaphore },
      });
    }

    if (
      newSemaphore === SemaphoreStatus.RED &&
      previousSemaphore !== SemaphoreStatus.RED
    ) {
      const alert = await client.alert.create({
        data: {
          studentId,
          type: AlertType.ATTENDANCE,
          priority: AlertPriority.CRITICAL,
          message: `ALERTA CRÍTICA: El alumno ${student.user.firstName} ${student.user.lastName} ha acumulado ${stats.effectiveAbsences} faltas efectivas (Tasa: ${stats.attendanceRate}%). Se activa Semáforo Rojo.`,
        },
      });

      const admins = await client.user.findMany({
        where: { role: UserRole.ADMIN, isActive: true },
      });

      const effectiveSenderId = await this.resolveSenderId(senderId, client);

      const alertResult = {
        alert,
        effectiveAbsences: stats.effectiveAbsences,
        admins,
      };

      await this.dispatchAttendanceAlert(
        alertResult,
        student,
        effectiveSenderId,
        tx,
      );
    }

    return newSemaphore;
  }

  private async dispatchAttendanceAlert(
    alertResult: {
      alert: Alert;
      effectiveAbsences: number;
      admins: User[];
    },
    student: {
      user: { firstName: string; lastName: string };
      group?: { name: string } | null;
      parent?: {
        phone?: string | null;
        user?: { id: number; email: string } | null;
      } | null;
    },
    senderId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const { alert, effectiveAbsences, admins } = alertResult;
    const recipients: Array<{
      userId: number;
      email?: string;
      phone?: string;
      channels: string[];
    }> = [];

    if (student.parent?.user) {
      recipients.push({
        userId: student.parent.user.id,
        email: student.parent.user.email,
        phone: student.parent.phone || undefined,
        channels: ["EMAIL", "SMS"],
      });
    }

    for (const admin of admins) {
      recipients.push({
        userId: admin.id,
        email: admin.email,
        channels: ["IN_APP", "PUSH"],
      });
    }

    const payload = {
      alert: {
        id: alert.id,
        studentId: alert.studentId,
        type: alert.type,
        priority: alert.priority,
        message: `Semáforo Rojo: ${student.user.firstName} ${student.user.lastName} (${student.group?.name || "Sin grupo"}) - ${effectiveAbsences} faltas acumuladas.`,
      },
      recipients,
      senderId,
      title: "Alerta CBTIS 61",
    };

    if (tx) {
      await this.notificationRouter.dispatch(payload, tx);
    } else {
      await this.notificationRouter.dispatch(payload);
    }
  }

  async findAll(filters?: {
    studentId?: number;
    classId?: number;
    classScheduleId?: number;
    date?: Date;
  }): Promise<AttendanceWithDetails[]> {
    const where: Prisma.AttendanceWhereInput = {};
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.classScheduleId) {
      where.classScheduleId = filters.classScheduleId;
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
            group: true,
            classroom: true,
            schedules: true,
          },
        },
        classSchedule: {
          include: {
            classroom: true,
          },
        },
        logs: {
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
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  async findByStudent(studentId: number): Promise<AttendanceWithDetails[]> {
    return this.prisma.attendance.findMany({
      where: { studentId },
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
            group: true,
            classroom: true,
            schedules: true,
          },
        },
        classSchedule: {
          include: {
            classroom: true,
          },
        },
        logs: {
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
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  async correctAttendance(
    id: number,
    dto: CorrectAttendanceDto,
    user: IAuthenticatedUser,
  ): Promise<AttendanceWithDetails> {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        classes: {
          include: {
            teacher: true,
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException(
        `Registro de asistencia con ID ${id} no encontrado`,
      );
    }

    if (user.role === UserRole.TEACHER) {
      if (attendance.classes?.teacherId !== user.teacherProfile?.id) {
        throw new ForbiddenException(
          "No está autorizado para corregir la asistencia de esta clase. No es el docente asignado.",
        );
      }
    }

    const previousStatus = attendance.status;

    return this.prisma.$transaction(async (tx) => {
      // 1. Registrar entrada en el log de auditoría
      await tx.attendanceLog.create({
        data: {
          attendanceId: id,
          userId: user.id,
          previousStatus,
          newStatus: dto.status,
          reason: dto.reason,
        },
      });

      // 2. Actualizar estado y notas de la asistencia
      const updatedNotes = dto.notes
        ? attendance.notes
          ? `${attendance.notes} | Corrección: ${dto.notes}`
          : `Corrección: ${dto.notes}`
        : attendance.notes;

      const updated = await tx.attendance.update({
        where: { id },
        data: {
          status: dto.status,
          notes: updatedNotes,
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
              teacher: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              group: true,
              classroom: true,
              schedules: true,
            },
          },
          classSchedule: {
            include: {
              classroom: true,
            },
          },
          logs: {
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
            orderBy: { timestamp: "desc" },
          },
        },
      });

      // 3. Recalcular el semáforo del alumno automáticamente
      await this.recalculateStudentSemaphore(attendance.studentId, tx, user.id);

      return updated;
    });
  }

  async create(
    dto: CreateAttendanceDto,
    user: IAuthenticatedUser,
  ): Promise<AttendanceWithDetails> {
    const schedule = await this.prisma.classSchedule.findUnique({
      where: { id: dto.classScheduleId },
      include: {
        class: {
          include: {
            teacher: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException("Horario de clase no encontrado");
    }

    if (
      user.role === UserRole.TEACHER &&
      schedule.class.teacherId !== user.teacherProfile?.id
    ) {
      throw new ForbiddenException(
        "No está autorizado para registrar asistencias en esta clase",
      );
    }

    const attendanceDate = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.attendance.create({
        data: {
          studentId: dto.studentId,
          classId: dto.classId,
          classScheduleId: dto.classScheduleId,
          status: dto.status,
          date: attendanceDate,
          qrToken: dto.qrToken,
          notes: dto.notes,
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
              teacher: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              group: true,
              classroom: true,
              schedules: true,
            },
          },
          classSchedule: {
            include: {
              classroom: true,
            },
          },
          logs: {
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
            orderBy: { timestamp: "desc" },
          },
        },
      });

      await this.recalculateStudentSemaphore(dto.studentId, tx, user.id);

      return created;
    });
  }

  async getStudentAbsenceCount(
    studentId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<IStudentAttendanceStats> {
    const client = tx || this.prisma;

    const student = await client.studentProfile.findUnique({
      where: { id: studentId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException(`Alumno con ID ${studentId} no encontrado`);
    }

    const semester = await this.resolveActiveSemester(client);
    const now = new Date();
    const { todayEnd } = this.getMexicoCityTimeInfo(now);

    const dateFilter: Prisma.DateTimeFilter = {
      lte: todayEnd,
    };
    if (semester?.startDate) {
      dateFilter.gte = semester.startDate;
    }

    const attendances = await client.attendance.findMany({
      where: {
        studentId,
        date: dateFilter,
      },
      select: {
        status: true,
      },
    });

    return this.calculateAttendanceMetrics(attendances, semester, todayEnd);
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

  async resetSemaphore(
    studentId: number,
  ): Promise<{ success: boolean; message: string; student: StudentProfile }> {
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

  async exportCsv(filters?: {
    studentId?: number;
    classId?: number;
  }): Promise<Buffer> {
    const records = await this.findAll(filters);
    const sep = "sep=,\n";
    const header = "ID,Fecha,Alumno,Matrícula,Grupo,Materia,Estado,Notas\n";
    const rows = records.map((r: AttendanceWithDetails) => {
      const dateStr = r.date
        ? new Date(r.date).toISOString().split("T")[0]
        : "";
      const studentName = `"${r.student?.user?.firstName || ""} ${r.student?.user?.lastName || ""}"`;
      const enrollmentId = `"${r.student?.enrollmentId || ""}"`;
      const groupName = `"${r.student?.group?.name || ""}"`;
      const subjectName = `"${r.classes?.subject?.name || ""}"`;
      const status = `"${r.status}"`;
      const notes = `"${(r.notes || "").replace(/"/g, '""')}"`;
      return `${r.id},${dateStr},${studentName},${enrollmentId},${groupName},${subjectName},${status},${notes}`;
    });

    const csvString = sep + header + rows.join("\n");
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    return Buffer.concat([bom, Buffer.from(csvString, "utf-8")]);
  }

  async getSemaphoreSummary(): Promise<ISemaphoreSummaryResponse> {
    const students = await this.prisma.studentProfile.findMany({
      select: {
        id: true,
        semaphore: true,
        groupId: true,
        group: { select: { id: true, name: true } },
      },
    });

    const totalStudents = students.length;
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    const groupMap = new Map<number, IGroupSemaphoreSummary>();

    for (const s of students) {
      if (s.semaphore === SemaphoreStatus.GREEN) greenCount++;
      else if (s.semaphore === SemaphoreStatus.YELLOW) yellowCount++;
      else if (s.semaphore === SemaphoreStatus.RED) redCount++;

      const gId = s.groupId;
      if (!groupMap.has(gId)) {
        groupMap.set(gId, {
          groupId: gId,
          groupName: s.group?.name || `Grupo ${gId}`,
          total: 0,
          green: 0,
          yellow: 0,
          red: 0,
        });
      }

      const gData = groupMap.get(gId)!;
      gData.total++;
      if (s.semaphore === SemaphoreStatus.GREEN) gData.green++;
      else if (s.semaphore === SemaphoreStatus.YELLOW) gData.yellow++;
      else if (s.semaphore === SemaphoreStatus.RED) gData.red++;
    }

    const riskCount = yellowCount + redCount;
    const riskPercentage =
      totalStudents > 0
        ? parseFloat(((riskCount / totalStudents) * 100).toFixed(2))
        : 0;

    return {
      totalStudents,
      greenCount,
      yellowCount,
      redCount,
      riskCount,
      riskPercentage,
      byGroup: Array.from(groupMap.values()),
    };
  }
}
