import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateStudentBulkDto } from "./dto/create-student-bulk.dto";
import * as bcrypt from "bcryptjs";
import { UserRole } from "../common/enums/roles.enum";

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStudentDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify group exists
      const group = await tx.group.findUnique({ where: { id: dto.groupId } });
      if (!group)
        throw new NotFoundException(`Group with ID ${dto.groupId} not found`);

      // 2. Check if student enrollmentId already exists
      const existingStudent = await tx.studentProfile.findUnique({
        where: { enrollmentId: dto.enrollmentId },
      });
      if (existingStudent)
        throw new ConflictException(
          `Student with enrollment ${dto.enrollmentId} already exists`,
        );

      const existingUser = await tx.user.findUnique({
        where: { email: dto.studentEmail },
      });
      if (existingUser)
        throw new ConflictException(
          `User with email ${dto.studentEmail} already exists`,
        );

      // 3. Handle Parent
      let parentId: number;

      const parentEmailToUse =
        dto.parentEmail || `tutor_${dto.enrollmentId}@cbtis61.edu.mx`;

      // Try to find existing parent by email
      const existingParentUser = await tx.user.findUnique({
        where: { email: parentEmailToUse },
        include: { parentProfile: true },
      });

      if (existingParentUser) {
        if (
          existingParentUser.role !== UserRole.PARENT ||
          !existingParentUser.parentProfile
        ) {
          throw new BadRequestException(
            `User ${parentEmailToUse} exists but is not a PARENT`,
          );
        }
        parentId = existingParentUser.parentProfile.id;
      } else {
        // Create Parent
        parentId = await this.createParent(tx, dto, parentEmailToUse);
      }

      // 4. Create Student
      const studentPassword = dto.studentPassword || dto.enrollmentId; // Default password = enrollmentId
      const hashedStudentPassword = await bcrypt.hash(studentPassword, 12);

      const newStudentUser = await tx.user.create({
        data: {
          email: dto.studentEmail,
          password: hashedStudentPassword,
          firstName: dto.studentFirstName,
          lastName: dto.studentLastName,
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: dto.enrollmentId,
              groupId: dto.groupId,
              parentId: parentId,
              phone: dto.studentPhone,
            },
          },
        },
        include: {
          studentProfile: true,
        },
      });

      return newStudentUser;
    });
  }

  private async createParent(
    tx: any,
    dto: CreateStudentDto,
    parentEmail: string,
  ): Promise<number> {
    const parentPassword = dto.parentPassword || dto.parentPhone;
    const hashedPassword = await bcrypt.hash(parentPassword, 12);

    const newParentUser = await tx.user.create({
      data: {
        email: parentEmail,
        password: hashedPassword,
        firstName: dto.parentFirstName,
        lastName: dto.parentLastName,
        role: UserRole.PARENT,
        parentProfile: {
          create: {
            phone: dto.parentPhone,
            address: dto.parentAddress,
          },
        },
      },
      include: { parentProfile: true },
    });
    return newParentUser.parentProfile.id;
  }

  async createBulk(bulkDto: CreateStudentBulkDto) {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < bulkDto.students.length; i++) {
      const student = bulkDto.students[i];
      try {
        await this.create(student);
        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(
          `Row ${i + 1} (${student.enrollmentId}): ${error.message}`,
        );
      }
    }

    return results;
  }

  async findAll(groupId?: number) {
    return this.prisma.studentProfile.findMany({
      where: groupId ? { groupId } : undefined,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
        },
        group: {
          select: { id: true, name: true, career: true, gradeLevel: true },
        },
        parent: { include: { user: true } },
      },
    });
  }

  async remove(id: number) {
    // Delete user, which cascades to studentProfile
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
    });
    if (!profile) throw new NotFoundException("Student profile not found");

    return this.prisma.user.delete({
      where: { id: profile.userId },
    });
  }
}
