import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma.service";
import { execSync } from "child_process";

describe("Seed and DB integrity (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  // Test Case 1: Run the seed script
  it("1. should verify that the seed script successfully runs and resets the database", () => {
    // Execute npm run db:seed synchronously. Set timeout to 30000ms.
    const output = execSync("cmd /c npm run db:seed", {
      cwd: "C:\\Users\\Ed\\Documents\\Develop\\Impulso\\app\\backend",
      timeout: 30000,
    }).toString();

    expect(output).toContain("Seed completado exitosamente!");
  });

  // Test Case 2: Verify SchoolCycle
  it("2. should verify the existence of the default SchoolCycle", async () => {
    const cycle = await prisma.schoolCycle.findFirst({
      where: { cycleName: "Ciclo Escolar 2025-2026" },
    });
    expect(cycle).toBeDefined();
    expect(cycle!.cycleName).toBe("Ciclo Escolar 2025-2026");
  });

  // Test Case 3: Verify Semester
  it("3. should verify the existence of the default Semester", async () => {
    const semester = await prisma.semester.findFirst({
      where: { semesterName: { contains: "Semestre A" } },
    });
    expect(semester).toBeDefined();
  });

  // Test Case 4: Verify Classrooms
  it("4. should verify classrooms have been created (e.g. A-101)", async () => {
    const classroom = await prisma.classroom.findUnique({
      where: { name: "A-101" },
    });
    expect(classroom).toBeDefined();
    expect(classroom!.capacity).toBe(40);
  });

  // Test Case 5: Verify Groups
  it("5. should verify groups have been created (e.g. 3A - Programación)", async () => {
    const group = await prisma.group.findUnique({
      where: { name: "3A - Programación" },
    });
    expect(group).toBeDefined();
    expect(group!.career).toBe("Programación");
  });

  // Test Case 6: Verify Subjects
  it("6. should verify subjects have been created and assigned to teachers", async () => {
    const subject = await prisma.subject.findUnique({
      where: { code: "MAT-401" },
    });
    expect(subject).toBeDefined();
    expect(subject!.teacherId).toBeDefined();
  });

  // Test Case 7: Verify Classes and Schedules
  it("7. should verify classes and schedules have been created", async () => {
    const classes = await prisma.class.findMany({
      include: { schedules: true },
    });
    expect(classes.length).toBeGreaterThan(0);
    expect(classes[0].schedules.length).toBeGreaterThan(0);
  });

  // Test Case 8: Login as seeded Admin
  it("8. should successfully login as the seeded Admin user", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "subdirector@cbtis61.edu.mx",
        password: "admin123",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user).toHaveProperty("role", "ADMIN");
  });

  // Test Case 9: Login as seeded Teacher
  it("9. should successfully login as the seeded Teacher user", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "juan.perez@cbtis61.edu.mx",
        password: "teacher123",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user).toHaveProperty("role", "TEACHER");
  });

  // Test Case 10: Login as seeded Student
  it("10. should successfully login as the seeded Student user", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "alumno1@cbtis61.edu.mx",
        password: "student123",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user).toHaveProperty("role", "STUDENT");
  });
});
