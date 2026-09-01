import { NotificationStatus } from "@prisma/client";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { CreateGlobalNotificationDto } from "./dto/create-global-notification.dto";
import { NotificationRouterService } from "./notification-router.service";
import { UserRole } from "../common/enums/roles.enum";

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private notificationRouter: NotificationRouterService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto, senderId: number) {
    return this.prisma.notification.create({
      data: {
        ...createNotificationDto,
        senderId,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
      include: {
        alert: true,
        sender: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.notification.findMany({
      include: {
        alert: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        sender: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByRecipient(recipientId: number, recipientType: string) {
    return this.prisma.notification.findMany({
      where: {
        recipientId,
        recipientType,
      },
      include: {
        alert: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                group: true,
              },
            },
          },
        },
        sender: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        alert: true,
        sender: { select: { firstName: true, lastName: true } },
      },
    });

    if (!notification) {
      throw new NotFoundException("Notificación no encontrada");
    }

    return notification;
  }

  async sendGlobalNotification(adminId: number, dto: CreateGlobalNotificationDto) {
    const whereClause: any = { isActive: true };
    if (dto.targetRoles && dto.targetRoles.length > 0) {
      whereClause.role = { in: dto.targetRoles };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        adminProfile: true,
        teacherProfile: true,
        studentProfile: true,
        parentProfile: true,
      },
    });

    if (users.length === 0) {
      return { message: "No se encontraron usuarios para el aviso global", count: 0 };
    }

    const recipients = users.map((user) => {
      let phone: string | undefined;
      if (user.role === UserRole.ADMIN) phone = user.adminProfile?.phone || undefined;
      else if (user.role === UserRole.TEACHER) phone = user.teacherProfile?.phone || undefined;
      else if (user.role === UserRole.STUDENT) phone = user.studentProfile?.phone || undefined;
      else if (user.role === UserRole.PARENT) phone = user.parentProfile?.phone;

      return {
        userId: user.id,
        email: user.email,
        phone,
        channels: [dto.channel || "IN_APP"],
      };
    });

    // Fire-and-forget router dispatch
    this.notificationRouter.dispatch({
      globalMessage: dto.content,
      recipients,
      senderId: adminId,
      title: "Aviso Global - CBTIS 61",
    }).catch(err => {
      console.error("Error dispatching global notification", err);
    });

    return { message: "Aviso global enviado y procesándose", count: users.length };
  }

  async markAsRead(id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException("Notificación no encontrada");
    }

    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.READ },
    });
  }

  async getUnreadCount(recipientId: number, recipientType: string) {
    return this.prisma.notification.count({
      where: {
        recipientId,
        recipientType,
        status: { not: NotificationStatus.READ },
      },
    });
  }

  async sendManualNotification(
    studentId: number,
    recipientType: string,
    channel: string,
    content: string,
    senderId: number,
  ) {
    let recipient: { userId: number; email?: string; phone?: string };

    if (recipientType === "PARENT") {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: { parentId: true },
      });
      if (!student) {
        throw new NotFoundException("Alumno no encontrado");
      }
      if (!student.parentId) {
        throw new NotFoundException("El alumno no tiene tutor asignado");
      }
      const parent = await this.prisma.parentProfile.findUnique({
        where: { id: student.parentId },
        include: {
          user: { select: { id: true, email: true } },
        },
      });
      if (!parent) {
        throw new NotFoundException("Perfil de tutor no encontrado");
      }
      recipient = {
        userId: parent.user.id,
        email: parent.user.email || undefined,
        phone: parent.phone || undefined,
      };
    } else if (recipientType === "STUDENT") {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { id: true, email: true } },
        },
      });
      if (!student) {
        throw new NotFoundException("Perfil de alumno no encontrado");
      }
      recipient = {
        userId: student.user.id,
        email: student.user.email || undefined,
        phone: student.phone || undefined,
      };
    } else {
      throw new BadRequestException(
        "Tipo de destinatario no válido. Actualmente solo se soportan STUDENT y PARENT.",
      );
    }

    const alert = await this.prisma.alert.create({
      data: {
        studentId,
        type: "GENERAL",
        priority: "MEDIUM",
        message: content,
      },
    });

    await this.notificationRouter.dispatch({
      alert: {
        id: alert.id,
        studentId,
        type: alert.type,
        priority: alert.priority,
        message: content,
      },
      recipients: [
        {
          userId: recipient.userId,
          email: recipient.email,
          phone: recipient.phone,
          channels: [channel],
        },
      ],
      senderId,
      title: "Notificación CBTIS 61",
    });

    return this.prisma.notification.findFirst({
      where: { alertId: alert.id, recipientId: recipient.userId },
      include: { alert: true },
    });
  }
}
