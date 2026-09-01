import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma.service";
import { UserRole } from "../src/common/enums/roles.enum";
import { AttendanceStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

function getMexicoCityDayAndTime() {
  const date = new Date();
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  const match = formatted.match(
    /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) throw new Error("Format match failed");
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

  const nowMin = parseInt(hours) * 60 + parseInt(minutes);
  let startMin = nowMin - 10;
  let endMin = nowMin + 50;
  if (startMin < 0) startMin = 0;
  if (endMin >= 1440) endMin = 1439;

  const formatMin = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  return {
    dayOfWeek: currentDay,
    startTime: formatMin(startMin),
    endTime: formatMin(endMin),
    currentTime,
  };
}

async function checkHasClassScheduleId(
  prisma: PrismaService,
): Promise<boolean> {
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

describe("Complex Scenarios & Tiers (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const testId = Date.now();
  const passwordHash = bcrypt.hashSync("password123", 12);

  // Core configurations to clean up
  let schoolCycleId: number;
  let semesterId: number;
  let groupId: number;
  let subjectId: number;

  let adminToken: string;
  let adminUserId: number;
  let teacherAToken: string;
  let teacherBToken: string;
  let teacherAProfileId: number;
  let teacherBProfileId: number;

  const createToken = (user: { id: number; email: string; role: any }) => {
    const secret =
      configService.get<string>("JWT_SECRET") || "impulso_jwt_secret";
    return jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { secret, expiresIn: "24h" },
    );
  };

  beforeAll(async () => {
    jest.setTimeout(25000);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix("api");
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);

    // Create Base Setup with wide semester range so backfilled tests are within active bounds
    const cycle = await prisma.schoolCycle.create({
      data: {
        cycleName: `Scenario Cycle ${testId}`,
        startDate: new Date(Date.now() - 60 * 86400000),
        finishDate: new Date(Date.now() + 60 * 86400000),
      },
    });
    schoolCycleId = cycle.id;

    const semester = await prisma.semester.create({
      data: {
        semesterName: `Scenario Semester ${testId}`,
        startDate: new Date(Date.now() - 60 * 86400000),
        finishDate: new Date(Date.now() + 60 * 86400000),
        schoolCycleId: cycle.id,
      },
    });
    semesterId = semester.id;

    // Ensure system user with ID 1 exists so that notifications do not fail
    const systemUser = await prisma.user.findUnique({ where: { id: 1 } });
    if (!systemUser) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "users" (id, email, password, "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
        VALUES (1, 'system@cbtis61.edu.mx', '${passwordHash}', 'System', 'Admin', 'ADMIN', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    // Ensure admin user exists so that admin login does not fail
    let adminUser = await prisma.user.findFirst({
      where: { email: "subdirector@cbtis61.edu.mx" },
    });
    if (!adminUser) {
      const hashedAdminPassword = bcrypt.hashSync("admin123", 12);
      adminUser = await prisma.user.create({
        data: {
          email: "subdirector@cbtis61.edu.mx",
          password: hashedAdminPassword,
          firstName: "Carlos",
          lastName: "Hernández López",
          role: UserRole.ADMIN,
          adminProfile: {
            create: { position: "Subdirector Académico", phone: "555-0101" },
          },
        },
      });
    }
    adminUserId = adminUser.id;
    adminToken = createToken(adminUser);

    // Sync users sequence to prevent unique constraint failures on auto-incrementing ID
    await prisma.$executeRawUnsafe(`
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
    `);

    const group = await prisma.group.create({
      data: {
        name: `Scenario Group ${testId}`,
        gradeLevel: 2,
        career: "Software",
      },
    });
    groupId = group.id;

    const subject = await prisma.subject.create({
      data: {
        name: `Scenario Subject ${testId}`,
        code: `SCEN-SUB-${testId}`,
      },
    });
    subjectId = subject.id;

    // Create Teacher A and Teacher B
    const teacherA = await prisma.user.create({
      data: {
        email: `teacherA-${testId}@example.com`,
        password: passwordHash,
        firstName: "Teacher",
        lastName: "A",
        role: UserRole.TEACHER,
        teacherProfile: {
          create: { employeeId: `EMP-A-${testId}` },
        },
      },
      include: { teacherProfile: true },
    });
    teacherAProfileId = teacherA.teacherProfile!.id;
    teacherAToken = createToken(teacherA);

    const teacherB = await prisma.user.create({
      data: {
        email: `teacherB-${testId}@example.com`,
        password: passwordHash,
        firstName: "Teacher",
        lastName: "B",
        role: UserRole.TEACHER,
        teacherProfile: {
          create: { employeeId: `EMP-B-${testId}` },
        },
      },
      include: { teacherProfile: true },
    });
    teacherBProfileId = teacherB.teacherProfile!.id;
    teacherBToken = createToken(teacherB);
  });

  afterAll(async () => {
    // Delete all attendance logs and classes created with Scenario Subjects
    const subjects = await prisma.subject.findMany({
      where: { code: { contains: `-${testId}` } },
    });
    const subjectIds = subjects.map((s) => s.id);
    const classes = await prisma.class.findMany({
      where: { subjectId: { in: subjectIds } },
    });
    const classIds = classes.map((c) => c.id);

    await prisma.attendanceLog.deleteMany({
      where: { attendance: { classId: { in: classIds } } },
    });
    await prisma.attendance.deleteMany({
      where: { classId: { in: classIds } },
    });
    await prisma.classSchedule.deleteMany({
      where: { classId: { in: classIds } },
    });
    await prisma.class.deleteMany({
      where: { id: { in: classIds } },
    });

    // Delete Student profiles and parent profiles created in this test run
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: `-${testId}` } },
      include: {
        studentProfile: true,
        parentProfile: true,
        teacherProfile: true,
      },
    });

    const studentIds = testUsers
      .filter((u) => u.studentProfile)
      .map((u) => u.studentProfile!.id);
    const parentIds = testUsers
      .filter((u) => u.parentProfile)
      .map((u) => u.parentProfile!.id);
    const teacherIds = testUsers
      .filter((u) => u.teacherProfile)
      .map((u) => u.teacherProfile!.id);

    if (studentIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { alert: { studentId: { in: studentIds } } },
      });
      await prisma.alert.deleteMany({
        where: { studentId: { in: studentIds } },
      });
      await prisma.attendance.deleteMany({
        where: { studentId: { in: studentIds } },
      });
      await prisma.studentProfile.deleteMany({
        where: { id: { in: studentIds } },
      });
    }
    if (parentIds.length > 0) {
      await prisma.parentProfile.deleteMany({
        where: { id: { in: parentIds } },
      });
    }
    if (teacherIds.length > 0) {
      await prisma.teacherProfile.deleteMany({
        where: { id: { in: teacherIds } },
      });
    }

    await prisma.user.deleteMany({
      where: { email: { contains: `-${testId}` } },
    });

    try {
      await prisma.subject.deleteMany({
        where: { code: { contains: `-${testId}` } },
      });
    } catch (e) {}
    try {
      if (groupId) await prisma.group.delete({ where: { id: groupId } });
    } catch (e) {}
    try {
      if (semesterId)
        await prisma.semester.delete({ where: { id: semesterId } });
    } catch (e) {}
    try {
      if (schoolCycleId)
        await prisma.schoolCycle.delete({ where: { id: schoolCycleId } });
    } catch (e) {}

    await app.close();
  });

  // Scenario 1: Student life-cycle
  it("1. should verify Student Life-Cycle (create parent, create student, login, generate QR, register attendance)", async () => {
    // 1. Admin creates Parent
    const parentRes = await request(app.getHttpServer())
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: `parent-lifecycle-${testId}@example.com`,
        password: "password123",
        firstName: "Parent",
        lastName: "Lifecycle",
        role: UserRole.PARENT,
        parentProfile: {
          phone: "555-9999",
        },
      });
    expect(parentRes.status).toBe(201);
    const parentUserObj = parentRes.body.user || parentRes.body;
    const parentProfile = await prisma.parentProfile.findFirst({
      where: { userId: parentUserObj.id },
    });
    const parentProfileId = parentProfile!.id;

    // 2. Admin creates Student linked to Parent
    const studentRes = await request(app.getHttpServer())
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: `student-lifecycle-${testId}@example.com`,
        password: "password123",
        firstName: "Student",
        lastName: "Lifecycle",
        role: UserRole.STUDENT,
        enrollmentId: `ENR-LC-${testId}`,
        groupId: groupId,
        parentId: parentProfileId,
      });
    expect(studentRes.status).toBe(201);
    const studentUserObj = studentRes.body.user || studentRes.body;
    const studentProfile = await prisma.studentProfile.findFirst({
      where: { userId: studentUserObj.id },
    });
    const studentProfileId = studentProfile!.id;

    // 3. Create Class and Schedule
    const timeInfo = getMexicoCityDayAndTime();
    const cl = await prisma.class.create({
      data: {
        subjectId,
        groupId,
        teacherId: teacherAProfileId,
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

    // 4. Student token
    const studentToken = createToken(studentUserObj);

    // 5. Student gets QR token
    const qrRes = await request(app.getHttpServer())
      .post("/api/qr/refresh")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(qrRes.status).toBe(201);
    const qrToken = qrRes.body.qrToken;

    // 6. Teacher A scans QR to register attendance
    const scanRes = await request(app.getHttpServer())
      .post("/api/attendance/scan-qr")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        qrToken,
        classScheduleId: cl.schedules[0].id,
      });
    expect(scanRes.status).toBe(201);

    // 7. Parent verifies child's attendance
    const parentToken = createToken(parentUserObj);

    const historyRes = await request(app.getHttpServer())
      .get(`/api/attendance/student/${studentProfileId}`)
      .set("Authorization", `Bearer ${parentToken}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.length).toBeGreaterThan(0);
    expect(historyRes.body[0]).toHaveProperty("status", "PRESENT");
  });

  // Scenario 2: Red Semaphore trigger/reset
  it("2. should verify Red Semaphore Trigger and Reset (3 absences trigger RED, alert created, admin reset to GREEN)", async () => {
    // 1. Create a Student
    const parentProfile = await prisma.parentProfile.findFirst({
      where: {
        user: { email: `parent-lifecycle-${testId}@example.com` },
      },
    });

    const studentUser = await prisma.user.create({
      data: {
        email: `student-semaphore-${testId}@example.com`,
        password: passwordHash,
        firstName: "Sema",
        lastName: "Student",
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: `ENR-SEMA-${testId}`,
            groupId: groupId,
            parentId: parentProfile!.id,
          },
        },
      },
      include: { studentProfile: true },
    });
    const studentProfileId = studentUser.studentProfile!.id;

    // 2. Create Class and Schedule with sub2
    const sub2 = await prisma.subject.create({
      data: {
        name: `Scenario 2 Subject ${testId}`,
        code: `SCEN-SUB2-${testId}`,
      },
    });
    const timeInfo = getMexicoCityDayAndTime();
    const cl = await prisma.class.create({
      data: {
        subjectId: sub2.id,
        groupId,
        teacherId: teacherAProfileId,
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

    // 3. Backfill 2 historical absences within active semester bounds
    const date1 = new Date(Date.now() - 5 * 86400000);
    const date2 = new Date(Date.now() - 3 * 86400000);

    await prisma.attendance.create({
      data: {
        studentId: studentProfileId,
        classId: cl.id,
        classScheduleId: cl.schedules[0].id,
        status: AttendanceStatus.ABSENT,
        date: date1,
      },
    });
    await prisma.attendance.create({
      data: {
        studentId: studentProfileId,
        classId: cl.id,
        classScheduleId: cl.schedules[0].id,
        status: AttendanceStatus.ABSENT,
        date: date2,
      },
    });

    // 4. Mark 3rd absence today via REST API (this triggers the Red Semaphore)
    const absentRes = await request(app.getHttpServer())
      .post(
        `/api/attendance/mark-absent/${studentProfileId}/${cl.schedules[0].id}`,
      )
      .set("Authorization", `Bearer ${teacherAToken}`);

    expect(absentRes.status).toBe(201);
    expect(absentRes.body.success).toBe(true);

    // Verify student is RED in DB
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
    });
    expect(studentProfile!.semaphore).toBe("RED");

    // 5. Admin lists RED semaphore students
    const redList = await request(app.getHttpServer())
      .get("/api/attendance/semaphore/red")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(redList.status).toBe(200);
    const found = redList.body.some((s: any) => s.id === studentProfileId);
    expect(found).toBe(true);

    // 6. Admin resets semaphore
    const resetRes = await request(app.getHttpServer())
      .post(`/api/attendance/semaphore/reset/${studentProfileId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(201);
    expect(resetRes.body.success).toBe(true);

    // Verify student is GREEN in DB
    const studentProfilePostReset = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
    });
    expect(studentProfilePostReset!.semaphore).toBe("GREEN");
  });

  // Scenario 3: Double-period class smart scan
  it("3. should verify Double-period class smart scan (prevents duplicate scans on same day)", async () => {
    const parentProfile = await prisma.parentProfile.findFirst({
      where: {
        user: { email: `parent-lifecycle-${testId}@example.com` },
      },
    });

    // 1. Create a Student
    const studentUser = await prisma.user.create({
      data: {
        email: `student-double-${testId}@example.com`,
        password: passwordHash,
        firstName: "Double",
        lastName: "Student",
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: `ENR-DBL-${testId}`,
            groupId: groupId,
            parentId: parentProfile!.id,
          },
        },
      },
      include: { studentProfile: true },
    });
    const studentProfileId = studentUser.studentProfile!.id;

    // 2. Create Class with 2 schedules today
    const sub3 = await prisma.subject.create({
      data: {
        name: `Scenario 3 Subject ${testId}`,
        code: `SCEN-SUB3-${testId}`,
      },
    });
    const timeInfo = getMexicoCityDayAndTime();
    const cl = await prisma.class.create({
      data: {
        subjectId: sub3.id,
        groupId,
        teacherId: teacherAProfileId,
        semesterId,
        schedules: {
          create: [
            {
              dayOfWeek: timeInfo.dayOfWeek as any,
              startTime: timeInfo.startTime,
              endTime: timeInfo.endTime,
            },
            {
              dayOfWeek: timeInfo.dayOfWeek as any,
              startTime: timeInfo.startTime,
              endTime: timeInfo.endTime,
            },
          ],
        },
      },
      include: { schedules: true },
    });

    const studentToken = createToken(studentUser);

    // 3. Scan for Period 1
    const qrRes1 = await request(app.getHttpServer())
      .post("/api/qr/refresh")
      .set("Authorization", `Bearer ${studentToken}`);
    const qrToken1 = qrRes1.body.qrToken;

    const scanRes1 = await request(app.getHttpServer())
      .post("/api/attendance/scan-qr")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        qrToken: qrToken1,
        classScheduleId: cl.schedules[0].id,
      });
    expect(scanRes1.status).toBe(201);

    // 4. Scan for Period 2 - Checks database version dynamically
    const qrRes2 = await request(app.getHttpServer())
      .post("/api/qr/refresh")
      .set("Authorization", `Bearer ${studentToken}`);
    const qrToken2 = qrRes2.body.qrToken;

    const scanRes2 = await request(app.getHttpServer())
      .post("/api/attendance/scan-qr")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        qrToken: qrToken2,
        classScheduleId: cl.schedules[1].id,
      });

    const hasClassScheduleId = await checkHasClassScheduleId(prisma);

    if (hasClassScheduleId) {
      // If classScheduleId column is active, scan for different schedules is allowed
      expect(scanRes2.status).toBe(201);

      // Scanning for the SAME classScheduleId again today should fail
      const qrRes3 = await request(app.getHttpServer())
        .post("/api/qr/refresh")
        .set("Authorization", `Bearer ${studentToken}`);
      const qrToken3 = qrRes3.body.qrToken;

      const scanRes3 = await request(app.getHttpServer())
        .post("/api/attendance/scan-qr")
        .set("Authorization", `Bearer ${teacherAToken}`)
        .send({
          qrToken: qrToken3,
          classScheduleId: cl.schedules[0].id,
        });
      expect(scanRes3.status).toBe(400);
      expect(scanRes3.body.message.message || scanRes3.body.message).toBe(
        "La asistencia de este alumno ya fue registrada para este bloque de clase hoy",
      );
    } else {
      expect(scanRes2.status).toBe(400);
      expect(scanRes2.body.message.message || scanRes2.body.message).toBe(
        "La asistencia de este alumno ya fue registrada para esta clase hoy",
      );
    }
  });

  // Scenario 4: Teacher shift cover
  it("4. should verify Teacher shift cover (different teacher rejected, admin updates teacher, scan succeeds)", async () => {
    const parentProfile = await prisma.parentProfile.findFirst({
      where: {
        user: { email: `parent-lifecycle-${testId}@example.com` },
      },
    });

    // 1. Create Student
    const studentUser = await prisma.user.create({
      data: {
        email: `student-cover-${testId}@example.com`,
        password: passwordHash,
        firstName: "Cover",
        lastName: "Student",
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: `ENR-COV-${testId}`,
            groupId: groupId,
            parentId: parentProfile!.id,
          },
        },
      },
      include: { studentProfile: true },
    });

    // 2. Create Class assigned to Teacher A
    const sub4 = await prisma.subject.create({
      data: {
        name: `Scenario 4 Subject ${testId}`,
        code: `SCEN-SUB4-${testId}`,
      },
    });
    const timeInfo = getMexicoCityDayAndTime();
    const cl = await prisma.class.create({
      data: {
        subjectId: sub4.id,
        groupId,
        teacherId: teacherAProfileId,
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

    const studentToken = createToken(studentUser);

    // 3. Student generates QR code
    const qrRes = await request(app.getHttpServer())
      .post("/api/qr/refresh")
      .set("Authorization", `Bearer ${studentToken}`);
    const qrToken = qrRes.body.qrToken;

    // 4. Teacher B (unauthorized) scans QR code - Should fail with 403 Forbidden
    const scanFail = await request(app.getHttpServer())
      .post("/api/attendance/scan-qr")
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({
        qrToken,
        classScheduleId: cl.schedules[0].id,
      });
    expect(scanFail.status).toBe(403);
    expect(scanFail.body.message.message || scanFail.body.message).toBe(
      "No está autorizado para registrar asistencia en esta clase. El docente no coincide con el horario asignado.",
    );

    // 5. Admin updates Class teacher to Teacher B
    await prisma.class.update({
      where: { id: cl.id },
      data: { teacherId: teacherBProfileId },
    });

    // 6. Teacher B scans QR code - Should succeed
    const scanSuccess = await request(app.getHttpServer())
      .post("/api/attendance/scan-qr")
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({
        qrToken,
        classScheduleId: cl.schedules[0].id,
      });
    expect(scanSuccess.status).toBe(201);
  });

  // Scenario 5: Multi-role dashboard integrity
  it("5. should verify Multi-Role Dashboard integrity (unauthorized access rejected, authorized allowed)", async () => {
    const studentUser = await prisma.user.findFirst({
      where: { email: `student-lifecycle-${testId}@example.com` },
      include: { studentProfile: true },
    });
    const studentProfileId = studentUser!.studentProfile!.id;
    const studentToken = createToken(studentUser!);

    // 1. Student attempts to access red semaphore list - Should fail (403 Forbidden)
    const res1 = await request(app.getHttpServer())
      .get("/api/attendance/semaphore/red")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res1.status).toBe(403);

    // 2. Teacher attempts to access red semaphore list - Should succeed (200 OK)
    const res2 = await request(app.getHttpServer())
      .get("/api/attendance/semaphore/red")
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(res2.status).toBe(200);

    // 3. Teacher attempts to reset a semaphore - Should fail (403 Forbidden, Admin only)
    const res3 = await request(app.getHttpServer())
      .post(`/api/attendance/semaphore/reset/${studentProfileId}`)
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(res3.status).toBe(403);

    // 4. Admin attempts to reset a semaphore - Should succeed (201/200 OK)
    const res4 = await request(app.getHttpServer())
      .post(`/api/attendance/semaphore/reset/${studentProfileId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res4.status).toBe(201);

    // 5. Student attempts to view all users list - Should fail (403 Forbidden, Admin only)
    const res5 = await request(app.getHttpServer())
      .get("/api/users")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res5.status).toBe(403);
  });
});
