import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(createNotificationDto: CreateNotificationDto, senderId: number) {
    return this.prisma.notification.create({
      data: {
        ...createNotificationDto,
        senderId,
        status: "SENT",
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

  async markAsRead(id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException("Notificación no encontrada");
    }

    return this.prisma.notification.update({
      where: { id },
      data: { status: "READ" },
    });
  }

  async getUnreadCount(recipientId: number, recipientType: string) {
    return this.prisma.notification.count({
      where: {
        recipientId,
        recipientType,
        status: { not: "READ" },
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
    let recipientId: number;

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
        select: { userId: true },
      });
      if (!parent) {
        throw new NotFoundException("Perfil de tutor no encontrado");
      }
      recipientId = parent.userId;
    } else if (recipientType === "STUDENT") {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: { userId: true },
      });
      if (!student) {
        throw new NotFoundException("Perfil de alumno no encontrado");
      }
      recipientId = student.userId;
    } else {
      throw new BadRequestException("Tipo de destinatario no válido");
    }

    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          studentId,
          type: "GENERAL",
          priority: "MEDIUM",
          message: content,
        },
      });

      return tx.notification.create({
        data: {
          alertId: alert.id,
          senderId,
          recipientType,
          recipientId,
          channel,
          status: "SENT",
          content,
          sentAt: new Date(),
        },
        include: {
          alert: true,
        },
      });
    });
  }
}
