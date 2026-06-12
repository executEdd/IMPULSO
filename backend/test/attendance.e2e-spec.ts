import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma.service';
import { UserRole } from '../src/common/enums/roles.enum';
import * as bcrypt from 'bcryptjs';

function getMexicoCityDayAndTime() {
  const date = new Date();
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  const match = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
  if (!match) throw new Error('Format match failed');
  const [, month, day, year, hours, minutes] = match;

  const localYear = parseInt(year);
  const localMonth = parseInt(month) - 1;
  const localDay = parseInt(day);

  const days = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  const tempDate = new Date(localYear, localMonth, localDay);
  const currentDay = days[tempDate.getDay()];
  const currentTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

  const nowMin = parseInt(hours) * 60 + parseInt(minutes);
  let startMin = nowMin - 10;
  let endMin = nowMin + 50;
  if (startMin < 0) startMin = 0;
  if (endMin >= 1440) endMin = 1439;

  const formatMin = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  // Get a different day
  const otherDay = days[(tempDate.getDay() + 1) % 7];

  // Get a different time
  let wrongStartMin = nowMin - 180;
  let wrongEndMin = nowMin - 120;
  if (wrongStartMin < 0) {
    wrongStartMin = nowMin + 120;
    wrongEndMin = nowMin + 180;
  }

  return {
    dayOfWeek: currentDay,
    startTime: formatMin(startMin),
    endTime: formatMin(endMin),
    currentTime,
    otherDay,
    wrongStartTime: formatMin(wrongStartMin),
    wrongEndTime: formatMin(wrongEndMin),
  };
}

async function checkHasClassScheduleId(prisma: PrismaService): Promise<boolean> {
  try {
    const cols = await prisma.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'attendances' AND column_name = 'classScheduleId'
    `;
    return cols.length > 0;
  } catch (error) {
    return false;
  }
}

describe('AttendanceModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testId = Date.now();
  const passwordHash = bcrypt.hashSync('password123', 12);

  // Entities created during beforeAll
  let schoolCycleId: number;
  let semesterId: number;
  let groupId: number;
  let otherGroupId: number;
  let subjectId: number;

  let teacherUser: any;
  let teacherToken: string;
  let teacherProfileId: number;

  let otherTeacherUser: any;
  let otherTeacherToken: string;

  let studentUser: any;
  let studentToken: string;
  let studentProfileId: number;

  let otherStudentUser: any;
  let otherStudentToken: string;
  let otherStudentProfileId: number;

  let parentUser: any;
  let parentProfileId: number;

  let classId: number;
  let classScheduleId: number;
  let timeInfo: any;
  let hasClassScheduleId = false;

  beforeAll(async () => {
    jest.setTimeout(15000);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    // Ensure system user with ID 1 exists so that notifications (which hardcode senderId: 1) do not fail
    const systemUser = await prisma.user.findUnique({ where: { id: 1 } });
    if (!systemUser) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "users" (id, email, password, "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
        VALUES (1, 'system@cbtis61.edu.mx', '${passwordHash}', 'System', 'Admin', 'ADMIN', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    timeInfo = getMexicoCityDayAndTime();
    hasClassScheduleId = await checkHasClassScheduleId(prisma);

    // 1. Create Temporal Cycle & Semester
    const cycle = await prisma.schoolCycle.create({
      data: {
        cycleName: `Test Cycle ${testId}`,
        startDate: new Date(),
        finishDate: new Date(),
      },
    });
    schoolCycleId = cycle.id;

    const semester = await prisma.semester.create({
      data: {
        semesterName: `Test Semester ${testId}`,
        startDate: new Date(),
        finishDate: new Date(),
        schoolCycleId: cycle.id,
      },
    });
    semesterId = semester.id;

    // 2. Create Groups
    const group = await prisma.group.create({
      data: {
        name: `Test Group ${testId}`,
        gradeLevel: 1,
        career: 'Test Career',
      },
    });
    groupId = group.id;

    const otherGroup = await prisma.group.create({
      data: {
        name: `Other Group ${testId}`,
        gradeLevel: 1,
        career: 'Test Career',
      },
    });
    otherGroupId = otherGroup.id;

    // 3. Create Subject
    const subject = await prisma.subject.create({
      data: {
        name: `Test Subject ${testId}`,
        code: `SUB-${testId}`,
      },
    });
    subjectId = subject.id;

    // 4. Create Parent User + Profile
    const parentU = await prisma.user.create({
      data: {
        email: `parent-${testId}@example.com`,
        password: passwordHash,
        firstName: 'Test',
        lastName: 'Parent',
        role: UserRole.PARENT,
        parentProfile: {
          create: {
            phone: '1234567890',
          },
        },
      },
      include: { parentProfile: true },
    });
    parentUser = parentU;
    parentProfileId = parentU.parentProfile!.id;

    // 5. Create Student 1 (in Correct Group)
    const studentU = await prisma.user.create({
      data: {
        email: `student-${testId}@example.com`,
        password: passwordHash,
        firstName: 'Test',
        lastName: 'Student',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: `ENR-${testId}-1`,
            groupId: groupId,
            parentId: parentProfileId,
          },
        },
      },
      include: { studentProfile: true },
    });
    studentUser = studentU;
    studentProfileId = studentU.studentProfile!.id;

    // 6. Create Student 2 (in Wrong Group)
    const otherStudentU = await prisma.user.create({
      data: {
        email: `otherstudent-${testId}@example.com`,
        password: passwordHash,
        firstName: 'Other',
        lastName: 'Student',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: `ENR-${testId}-2`,
            groupId: otherGroupId,
            parentId: parentProfileId,
          },
        },
      },
      include: { studentProfile: true },
    });
    otherStudentUser = otherStudentU;
    otherStudentProfileId = otherStudentU.studentProfile!.id;

    // 7. Create Teacher User + Profile
    const teacherU = await prisma.user.create({
      data: {
        email: `teacher-${testId}@example.com`,
        password: passwordHash,
        firstName: 'Test',
        lastName: 'Teacher',
        role: UserRole.TEACHER,
        teacherProfile: {
          create: {
            employeeId: `EMP-${testId}-1`,
          },
        },
      },
      include: { teacherProfile: true },
    });
    teacherUser = teacherU;
    teacherProfileId = teacherU.teacherProfile!.id;

    // 8. Create Other Teacher User + Profile
    const otherTeacherU = await prisma.user.create({
      data: {
        email: `otherteacher-${testId}@example.com`,
        password: passwordHash,
        firstName: 'Other',
        lastName: 'Teacher',
        role: UserRole.TEACHER,
        teacherProfile: {
          create: {
            employeeId: `EMP-${testId}-2`,
          },
        },
      },
      include: { teacherProfile: true },
    });
    otherTeacherUser = otherTeacherU;

    // 9. Create Class & Dynamic ClassSchedule
    const cl = await prisma.class.create({
      data: {
        subjectId,
        groupId,
        teacherId: teacherProfileId,
        semesterId,
        schedules: {
          create: {
            dayOfWeek: timeInfo.dayOfWeek as any,
            startTime: timeInfo.startTime,
            endTime: timeInfo.endTime,
          },
        },
      },
      include: { schedules: true },
    });
    classId = cl.id;
    classScheduleId = cl.schedules[0].id;

    // 10. Login to get JWT tokens
    const loginStudent = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: studentUser.email, password: 'password123' });
    studentToken = loginStudent.body.accessToken;

    const loginOtherStudent = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: otherStudentUser.email, password: 'password123' });
    otherStudentToken = loginOtherStudent.body.accessToken;

    const loginTeacher = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: teacherUser.email, password: 'password123' });
    teacherToken = loginTeacher.body.accessToken;

    const loginOtherTeacher = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: otherTeacherUser.email, password: 'password123' });
    otherTeacherToken = loginOtherTeacher.body.accessToken;
  });

  afterAll(async () => {
    // Cascade delete via Prisma
    if (classId) {
      await prisma.attendance.deleteMany({ where: { classId } });
      await prisma.classSchedule.deleteMany({ where: { classId } });
      await prisma.class.deleteMany({ where: { id: classId } });
    }
    await prisma.studentProfile.deleteMany({
      where: { id: { in: [studentProfileId, otherStudentProfileId] } },
    });
    await prisma.teacherProfile.deleteMany({
      where: { userId: { in: [teacherUser.id, otherTeacherUser.id] } },
    });
    await prisma.parentProfile.deleteMany({ where: { id: parentProfileId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `-${testId}`,
        },
      },
    });
    if (subjectId) {
      await prisma.subject.delete({ where: { id: subjectId } });
    }
    if (groupId) {
      await prisma.group.delete({ where: { id: groupId } });
    }
    if (otherGroupId) {
      await prisma.group.delete({ where: { id: otherGroupId } });
    }
    if (semesterId) {
      await prisma.semester.delete({ where: { id: semesterId } });
    }
    if (schoolCycleId) {
      await prisma.schoolCycle.delete({ where: { id: schoolCycleId } });
    }

    await app.close();
  });

  // Test Case 1: scan QR successfully
  it('1. should successfully record attendance using a valid QR token within the schedule window', async () => {
    // Refresh QR token as student
    const qrRes = await request(app.getHttpServer())
      .post('/api/qr/refresh')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(qrRes.status).toBe(201);
    const qrToken = qrRes.body.qrToken;
    expect(qrToken).toBeDefined();

    // Scan QR as teacher
    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken,
        classScheduleId,
      });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body).toHaveProperty('status', 'PRESENT');
    expect(scanRes.body).toHaveProperty('studentId', studentProfileId);
    expect(scanRes.body).toHaveProperty('classId', classId);
  });

  // Test Case 2: fail if QR invalid
  it('2. should fail to record attendance if the QR token is invalid (does not exist)', async () => {
    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken: 'invalid-non-existent-token',
        classScheduleId,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toBe('Token QR inválido o expirado');
  });

  // Test Case 3: fail if QR expired
  it('3. should fail to record attendance if the QR token has expired', async () => {
    // Generate QR in DB manually and set it expired
    const expiredToken = `expired-${testId}`;
    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: {
        qrToken: expiredToken,
        qrExpiresAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
      },
    });

    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken: expiredToken,
        classScheduleId,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toBe('El token QR ha expirado. El alumno debe refrescar su credencial digital.');
  });

  // Test Case 4: fail if student is not in correct group
  it('4. should fail to record attendance if the student is not in the correct group', async () => {
    // Generate QR for other student
    const qrRes = await request(app.getHttpServer())
      .post('/api/qr/refresh')
      .set('Authorization', `Bearer ${otherStudentToken}`);
    const qrToken = qrRes.body.qrToken;

    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken,
        classScheduleId,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toContain('Inconsistencia de grupo');
  });

  // Test Case 5: fail if teacher scanning is wrong
  it('5. should fail to record attendance if the teacher scanning the QR is not the one assigned to the class', async () => {
    // Refresh QR token for correct student
    const qrRes = await request(app.getHttpServer())
      .post('/api/qr/refresh')
      .set('Authorization', `Bearer ${studentToken}`);
    const qrToken = qrRes.body.qrToken;

    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({
        qrToken,
        classScheduleId,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toBe('No está autorizado para registrar asistencia en esta clase. El docente no coincide con el horario asignado.');
  });

  // Test Case 6: fail if day of the week is incorrect
  it('6. should fail to record attendance if the class is on a different day of the week', async () => {
    // Create a temporary class on a different day
    const wrongClass = await prisma.class.create({
      data: {
        subjectId,
        groupId,
        teacherId: teacherProfileId,
        semesterId,
        schedules: {
          create: {
            dayOfWeek: timeInfo.otherDay as any,
            startTime: timeInfo.startTime,
            endTime: timeInfo.endTime,
          },
        },
      },
      include: { schedules: true },
    });

    const qrRes = await request(app.getHttpServer())
      .post('/api/qr/refresh')
      .set('Authorization', `Bearer ${studentToken}`);
    const qrToken = qrRes.body.qrToken;

    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken,
        classScheduleId: wrongClass.schedules[0].id,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toContain('Inconsistencia de día');

    // Cleanup wrong class
    await prisma.classSchedule.deleteMany({ where: { classId: wrongClass.id } });
    await prisma.class.delete({ where: { id: wrongClass.id } });
  });

  // Test Case 7: fail if current time is outside the schedule window
  it('7. should fail to record attendance if the current time is outside the schedule window (+/- 15 mins)', async () => {
    // Create a temporary class at a wrong time
    const wrongTimeClass = await prisma.class.create({
      data: {
        subjectId,
        groupId,
        teacherId: teacherProfileId,
        semesterId,
        schedules: {
          create: {
            dayOfWeek: timeInfo.dayOfWeek as any,
            startTime: timeInfo.wrongStartTime,
            endTime: timeInfo.wrongEndTime,
          },
        },
      },
      include: { schedules: true },
    });

    const qrRes = await request(app.getHttpServer())
      .post('/api/qr/refresh')
      .set('Authorization', `Bearer ${studentToken}`);
    const qrToken = qrRes.body.qrToken;

    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken,
        classScheduleId: wrongTimeClass.schedules[0].id,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toContain('Inconsistencia de horario');

    // Cleanup wrong class
    await prisma.classSchedule.deleteMany({ where: { classId: wrongTimeClass.id } });
    await prisma.class.delete({ where: { id: wrongTimeClass.id } });
  });

  // Test Case 8: fail if already registered today
  it('8. should fail to record attendance if attendance is already registered for this student, class, and day', async () => {
    // Refresh student QR
    const qrRes = await request(app.getHttpServer())
      .post('/api/qr/refresh')
      .set('Authorization', `Bearer ${studentToken}`);
    const qrToken = qrRes.body.qrToken;

    // Scan again
    const scanRes = await request(app.getHttpServer())
      .post('/api/attendance/scan-qr')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        qrToken,
        classScheduleId,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toBe('La asistencia de este alumno ya fue registrada para esta clase hoy');
  });

  // Test Case 9: list attendances with filters
  it('9. should list attendances using filters (findAll)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/attendance?studentId=${studentProfileId}&classId=${classId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('studentId', studentProfileId);
    expect(res.body[0]).toHaveProperty('classId', classId);
  });

  // Test Case 10: get stats
  it('10. should retrieve attendance stats for a student', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/attendance/stats/student/${studentProfileId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('absences');
    expect(res.body).toHaveProperty('totalClasses');
    expect(res.body).toHaveProperty('attendanceRate');
  });
});
