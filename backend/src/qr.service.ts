import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import * as QRCode from "qrcode";
import { randomBytes } from "crypto";

export interface StudentQrResponse {
  qrToken: string | null;
  qrImage: string | null;
  expiresAt: Date | null;
  isValid: boolean;
}

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  private async generateQrImage(qrToken: string): Promise<string> {
    return QRCode.toDataURL(qrToken, {
      width: 300,
      margin: 2,
      color: {
        dark: "#1e3a5f",
        light: "#ffffff",
      },
    });
  }

  async generateQrForStudent(studentId: number): Promise<StudentQrResponse> {
    const refreshInterval = parseInt(
      this.configService.get<string>("QR_REFRESH_INTERVAL") || "30",
      10,
    );

    const qrToken = this.generateToken();

    const expiresAt = new Date(Date.now() + refreshInterval * 1000);

    await this.prisma.studentProfile.update({
      where: {
        id: studentId,
      },
      data: {
        qrToken,
        qrExpiresAt: expiresAt,
      },
    });

    const qrImage = await this.generateQrImage(qrToken);

    return {
      qrToken,
      qrImage,
      expiresAt,
      isValid: true,
    };
  }

  async refreshStudentQr(studentId: number): Promise<StudentQrResponse> {
    return this.generateQrForStudent(studentId);
  }

  async getStudentQr(studentId: number): Promise<StudentQrResponse> {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        id: studentId,
      },
      select: {
        qrToken: true,
        qrExpiresAt: true,
      },
    });

    if (!student || !student.qrToken) {
      return {
        qrToken: null,
        qrImage: null,
        expiresAt: null,
        isValid: false,
      };
    }

    const isValid = student.qrExpiresAt
      ? new Date() < student.qrExpiresAt
      : false;

    if (!isValid) {
      return {
        qrToken: student.qrToken,
        qrImage: null,
        expiresAt: student.qrExpiresAt,
        isValid: false,
      };
    }

    const qrImage = await this.generateQrImage(student.qrToken);

    return {
      qrToken: student.qrToken,
      qrImage,
      expiresAt: student.qrExpiresAt,
      isValid: true,
    };
  }

  async validateQrToken(qrToken: string): Promise<{
    valid: boolean;
    studentId?: number;
    message?: string;
  }> {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        qrToken,
      },
      select: {
        id: true,
        qrExpiresAt: true,
      },
    });

    if (!student) {
      return {
        valid: false,
        message: "Token QR no encontrado",
      };
    }

    if (student.qrExpiresAt && new Date() > student.qrExpiresAt) {
      return {
        valid: false,
        message: "Token QR expirado",
        studentId: student.id,
      };
    }

    return {
      valid: true,
      studentId: student.id,
    };
  }
}
