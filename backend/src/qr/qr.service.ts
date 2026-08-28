import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma.service";
import * as QRCode from "qrcode";
import * as crypto from "crypto";

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

  private generateToken(studentId: number): string {
    const secret = this.configService.get<string>("QR_SECRET") || "impulso_secret";
    const dateStr = new Date().toISOString().split("T")[0];
    
    const hash = crypto.createHmac("sha256", secret)
      .update(`${studentId}-${dateStr}`)
      .digest("hex");
      
    return `${studentId}:${dateStr}:${hash}`;
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
    const qrToken = this.generateToken(studentId);

    const now = new Date();
    const expiresAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
    if (!qrToken) return { valid: false, message: "Token QR no proporcionado" };

    const parts = qrToken.split(":");
    if (parts.length !== 3) return { valid: false, message: "Formato de token QR inválido" };

    const [studentIdStr, dateStr, signature] = parts;
    const studentId = parseInt(studentIdStr, 10);
    
    if (isNaN(studentId)) return { valid: false, message: "ID inválido en el token" };

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    if (dateStr !== todayStr) {
      return { valid: false, message: "El token QR ha expirado o no corresponde al día de hoy" };
    }

    const secret = this.configService.get<string>("QR_SECRET") || "impulso_secret";
    
    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(`${studentId}-${dateStr}`)
      .digest("hex");

    if (signature !== expectedHash) {
      return { valid: false, message: "Firma de QR inválida o alterada" };
    }

    return { valid: true, studentId };
  }
}
