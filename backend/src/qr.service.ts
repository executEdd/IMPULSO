import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

@Injectable()
export class QrService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async generateQrForStudent(studentId: number): Promise<{ qrToken: string; qrImage: string; expiresAt: Date }> {
    const refreshInterval = parseInt(this.configService.get<string>('QR_REFRESH_INTERVAL') || '30');
    const qrToken = this.generateToken();
    const expiresAt = new Date(Date.now() + refreshInterval * 1000);

    await this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { qrToken, qrExpiresAt: expiresAt },
    });

    // Generar imagen QR
    const qrImage = await QRCode.toDataURL(qrToken, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1e3a5f',
        light: '#ffffff',
      },
    });

    return { qrToken, qrImage, expiresAt };
  }

  async refreshStudentQr(studentId: number): Promise<{ qrToken: string; qrImage: string; expiresAt: Date }> {
    return this.generateQrForStudent(studentId);
  }

  async getStudentQr(studentId: number): Promise<{ qrToken: string | null; qrImage: string | null; expiresAt: Date | null; isValid: boolean }> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { qrToken: true, qrExpiresAt: true },
    });

    if (!student || !student.qrToken) {
      return { qrToken: null, qrImage: null, expiresAt: null, isValid: false };
    }

    const isValid = student.qrExpiresAt ? new Date() < student.qrExpiresAt : false;

    let qrImage = null;
    if (isValid) {
      qrImage = await QRCode.toDataURL(student.qrToken, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e3a5f',
          light: '#ffffff',
        },
      });
    }

    return {
      qrToken: student.qrToken,
      qrImage,
      expiresAt: student.qrExpiresAt,
      isValid,
    };
  }

  async validateQrToken(qrToken: string): Promise<{ valid: boolean; studentId?: number; message?: string }> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { qrToken },
      select: { id: true, qrExpiresAt: true },
    });

    if (!student) {
      return { valid: false, message: 'Token QR no encontrado' };
    }

    if (student.qrExpiresAt && new Date() > student.qrExpiresAt) {
      return { valid: false, message: 'Token QR expirado', studentId: student.id };
    }

    return { valid: true, studentId: student.id };
  }
}
