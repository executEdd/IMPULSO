import {
  PrismaClient,
  UserRole,
  DayOfWeek,
  SemaphoreStatus,
  GradeStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed de datos...");

  // 1. Generar hashes de contraseñas ANTES de la transacción DB (evita timeouts de conexión / PgBouncer)
  console.log("Generando hashes de contraseñas...");
  const adminPassword = await bcrypt.hash("admin123", 12);
  const teacherPassword = await bcrypt.hash("teacher123", 12);
  const studentPassword = await bcrypt.hash("student123", 12);
  const parentPassword = await bcrypt.hash("parent123", 12);

  try {
    await prisma.$transaction(async (tx) => {
      // Limpieza en orden por dependencias de llaves foráneas
      await tx.gradeLog.deleteMany();
      await tx.notification.deleteMany();
      await tx.alert.deleteMany();
      await tx.grade.deleteMany();
      await tx.attendance.deleteMany();
      await tx.classSchedule.deleteMany();
      await tx.class.deleteMany();
      await tx.classroom.deleteMany();
      await tx.semester.deleteMany();
      await tx.schoolCycle.deleteMany();
      await tx.studentProfile.deleteMany();
      await tx.parentProfile.deleteMany();
      await tx.teacherProfile.deleteMany();
      await tx.adminProfile.deleteMany();
      await tx.subject.deleteMany();
      await tx.group.deleteMany();
      await tx.user.deleteMany();

      // Reiniciar secuencias de auto-incremento
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS admin_profiles_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS teacher_profiles_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS student_profiles_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS parent_profiles_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS groups_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS subjects_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS school_cycle_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS semesters_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS attendances_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS grades_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS grade_logs_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS alerts_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS classes_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS classrooms_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS classes_schedules_id_seq RESTART WITH 1;');

      console.log("Base de datos limpia y secuencias reiniciadas");

      // Ciclo Escolar & Semestre
      const cycle = await tx.schoolCycle.create({
        data: {
          cycleName: "Ciclo Escolar 2025-2026",
          startDate: new Date("2025-08-01T00:00:00Z"),
          finishDate: new Date("2026-07-31T00:00:00Z"),
        },
      });

      const semester = await tx.semester.create({
        data: {
          semesterName: "Semestre A (Agosto 2025 - Enero 2026)",
          startDate: new Date("2025-08-18T00:00:00Z"),
          finishDate: new Date("2026-01-23T00:00:00Z"),
          schoolCycleId: cycle.id,
        },
      });

      console.log("Ciclo escolar y Semestre creados");

      // Aulas
      const classrooms = [];
      for (const c of [
        { name: "A-101", capacity: 40, description: "Aula del Edificio A" },
        { name: "A-102", capacity: 40, description: "Aula del Edificio A" },
        { name: "B-201", capacity: 40, description: "Aula del Edificio B" },
        { name: "C-301", capacity: 40, description: "Aula del Edificio C" },
        { name: "D-401", capacity: 40, description: "Aula del Edificio D" },
        { name: "LAB-1", capacity: 30, description: "Laboratorio de Cómputo 1" },
        { name: "LAB-2", capacity: 30, description: "Laboratorio de Cómputo 2" },
      ]) {
        classrooms.push(await tx.classroom.create({ data: c }));
      }

      const classroomMap = new Map(classrooms.map((c) => [c.name, c.id]));
      console.log("Aulas creadas");

      // Grupos
      const groups = [];
      for (const g of [
        { name: "3A - Programación", gradeLevel: 3, career: "Programación" },
        { name: "3B - Programación", gradeLevel: 3, career: "Programación" },
        { name: "4A - Contabilidad", gradeLevel: 4, career: "Contabilidad" },
        { name: "5A - Electrónica", gradeLevel: 5, career: "Electrónica" },
        { name: "6A - Mecatrónica", gradeLevel: 6, career: "Mecatrónica" },
      ]) {
        groups.push(await tx.group.create({ data: g }));
      }
      console.log("Grupos creados");

      // Materias
      const subjects = [];
      for (const s of [
        { name: "Matemáticas IV", code: "MAT-401", description: "Cálculo diferencial e integral", credits: 4 },
        { name: "Física III", code: "FIS-301", description: "Electricidad y magnetismo", credits: 4 },
        { name: "Programación Web", code: "PRO-501", description: "Desarrollo de aplicaciones web", credits: 5 },
        { name: "Base de Datos", code: "BD-401", description: "Diseño y administración de BD", credits: 4 },
        { name: "Inglés IV", code: "ING-401", description: "Inglés técnico", credits: 3 },
        { name: "Ética Profesional", code: "ETI-201", description: "Valores y ética en el trabajo", credits: 2 },
        { name: "Electrónica Digital", code: "ELE-501", description: "Circuitos digitales", credits: 5 },
        { name: "Contabilidad General", code: "CON-301", description: "Principios de contabilidad", credits: 4 },
      ]) {
        subjects.push(await tx.subject.create({ data: s }));
      }
      console.log("Materias creadas");

      // Admin
      const admin = await tx.user.create({
        data: {
          email: "subdirector@cbtis61.edu.mx",
          password: adminPassword,
          firstName: "Carlos",
          lastName: "Hernández López",
          role: UserRole.ADMIN,
          adminProfile: {
            create: { position: "Subdirector Académico", phone: "555-0101" },
          },
        },
      });

      // Docentes
      const teachers = [];
      for (const t of [
        {
          email: "juan.perez@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "Juan",
          lastName: "Pérez García",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-001", specialty: "Matemáticas", phone: "555-0201" },
          },
        },
        {
          email: "maria.gonzalez@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "María",
          lastName: "González Ruiz",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-002", specialty: "Programación", phone: "555-0202" },
          },
        },
        {
          email: "pedro.sanchez@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "Pedro",
          lastName: "Sánchez Torres",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-003", specialty: "Física", phone: "555-0203" },
          },
        },
        {
          email: "ana.lopez@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "Ana",
          lastName: "López Martínez",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-004", specialty: "Inglés", phone: "555-0204" },
          },
        },
      ]) {
        teachers.push(await tx.user.create({ data: t }));
      }
      console.log("Docentes creados");

      // Padres / Tutores
      const parents = [];
      for (const p of [
        {
          email: "padre1@email.com",
          password: parentPassword,
          firstName: "Roberto",
          lastName: "Martínez Cruz",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0301", address: "Calle Principal #123, Ciudad" },
          },
        },
        {
          email: "padre2@email.com",
          password: parentPassword,
          firstName: "Laura",
          lastName: "Díaz Flores",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0302", address: "Av. Juárez #456, Ciudad" },
          },
        },
        {
          email: "padre3@email.com",
          password: parentPassword,
          firstName: "Fernando",
          lastName: "Castillo Vega",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0303", address: "Calle Hidalgo #789, Ciudad" },
          },
        },
      ]) {
        parents.push(await tx.user.create({ data: p }));
      }
      console.log("Padres de familia creados");

      // Alumnos
      const students = [];
      for (const s of [
        {
          email: "alumno1@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Luis",
          lastName: "Martínez Hernández",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-001",
              groupId: groups[0].id,
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[0].id } }))!.id,
              phone: "246-100-0001",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno2@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Sofía",
          lastName: "Díaz Ramírez",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-002",
              groupId: groups[0].id,
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[1].id } }))!.id,
              phone: "246-100-0002",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno3@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Diego",
          lastName: "Castillo Morales",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-003",
              groupId: groups[1].id,
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[2].id } }))!.id,
              phone: "246-100-0003",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno4@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Valentina",
          lastName: "Hernández Silva",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-004",
              groupId: groups[2].id,
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[0].id } }))!.id,
              phone: "246-100-0004",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno5@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Mateo",
          lastName: "García Torres",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-005",
              groupId: groups[3].id,
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[1].id } }))!.id,
              phone: "246-100-0005",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
      ]) {
        students.push(await tx.user.create({ data: s }));
      }
      console.log("Alumnos creados");

      // Asignar materias a docentes
      await tx.subject.update({
        where: { id: subjects[0].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[0].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[1].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[2].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[2].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[1].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[3].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[1].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[4].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[3].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[5].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[0].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[6].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[2].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[7].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[3].id } }))!.id },
      });
      console.log("Materias asignadas a docentes");

      // Clases y Horarios
      const teacherProfiles = await tx.teacherProfile.findMany();
      const teacherMap = new Map(teacherProfiles.map((t) => [t.userId, t.id]));

      for (const c of [
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("A-101")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "07:00", endTime: "08:30", classroomId: classroomMap.get("A-101")! },
              { dayOfWeek: DayOfWeek.TUESDAY, startTime: "08:30", endTime: "10:00", classroomId: classroomMap.get("A-101")! },
            ],
          },
        },
        {
          subjectId: subjects[1].id,
          teacherId: teacherMap.get(teachers[2].id)!,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("A-101")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "08:30", endTime: "10:00", classroomId: classroomMap.get("A-101")! },
            ],
          },
        },
        {
          subjectId: subjects[2].id,
          teacherId: teacherMap.get(teachers[1].id)!,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("LAB-1")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "10:00", endTime: "11:30", classroomId: classroomMap.get("LAB-1")! },
              { dayOfWeek: DayOfWeek.TUESDAY, startTime: "11:30", endTime: "13:00", classroomId: classroomMap.get("LAB-1")! },
            ],
          },
        },
        {
          subjectId: subjects[4].id,
          teacherId: teacherMap.get(teachers[3].id)!,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("A-101")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "11:30", endTime: "13:00", classroomId: classroomMap.get("A-101")! },
            ],
          },
        },
        {
          subjectId: subjects[3].id,
          teacherId: teacherMap.get(teachers[1].id)!,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("LAB-2")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.TUESDAY, startTime: "07:00", endTime: "08:30", classroomId: classroomMap.get("LAB-2")! },
            ],
          },
        },
        {
          subjectId: subjects[5].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("A-101")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30", classroomId: classroomMap.get("A-101")! },
            ],
          },
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[1].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("A-102")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "13:30", endTime: "15:00", classroomId: classroomMap.get("A-102")! },
            ],
          },
        },
        {
          subjectId: subjects[1].id,
          teacherId: teacherMap.get(teachers[2].id)!,
          groupId: groups[1].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("A-102")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "15:00", endTime: "16:30", classroomId: classroomMap.get("A-102")! },
            ],
          },
        },
        {
          subjectId: subjects[7].id,
          teacherId: teacherMap.get(teachers[3].id)!,
          groupId: groups[2].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("B-201")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "07:00", endTime: "08:30", classroomId: classroomMap.get("B-201")! },
            ],
          },
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[2].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("B-201")!,
          schedules: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, startTime: "08:30", endTime: "10:00", classroomId: classroomMap.get("B-201")! },
            ],
          },
        },
      ]) {
        await tx.class.create({ data: c });
      }
      console.log("Clases y Horarios creados");

      // Calificaciones Iniciales para Alumno 1
      const firstStudent = await tx.studentProfile.findFirst({
        where: { user: { email: "alumno1@cbtis61.edu.mx" } },
      });

      if (firstStudent) {
        await tx.grade.createMany({
          data: [
            { studentId: firstStudent.id, subjectId: subjects[0].id, partial1: 8.5, partial2: 9.0, partial3: 9.5, finalGrade: 9.0, status: GradeStatus.EXCELLENT, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[1].id, partial1: 7.8, partial2: 8.2, partial3: 8.6, finalGrade: 8.2, status: GradeStatus.REGULAR, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[2].id, partial1: 9.5, partial2: 9.8, partial3: 10.0, finalGrade: 9.8, status: GradeStatus.EXCELLENT, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[3].id, partial1: 8.7, partial2: 8.8, partial3: 9.2, finalGrade: 8.9, status: GradeStatus.REGULAR, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[4].id, partial1: 10.0, partial2: 10.0, partial3: 10.0, finalGrade: 10.0, status: GradeStatus.EXCELLENT, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[5].id, partial1: 9.0, partial2: 8.9, partial3: 9.4, finalGrade: 9.1, status: GradeStatus.EXCELLENT, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[6].id, partial1: 8.0, partial2: 8.5, partial3: 8.9, finalGrade: 8.5, status: GradeStatus.REGULAR, period: '2025-2026A' },
            { studentId: firstStudent.id, subjectId: subjects[7].id, partial1: 9.2, partial2: 9.1, partial3: 9.6, finalGrade: 9.3, status: GradeStatus.EXCELLENT, period: '2025-2026A' },
          ],
          skipDuplicates: true,
        });
        console.log("Calificaciones iniciales creadas para alumno1@cbtis61.edu.mx");
      }
    }, { timeout: 30000 });

    console.log("\n✅ Seed completado exitosamente!");
    console.log("\n📋 Credenciales de prueba:");
    console.log("   👤 Admin:    subdirector@cbtis61.edu.mx / admin123");
    console.log("   👨‍🏫 Docente:  juan.perez@cbtis61.edu.mx / teacher123");
    console.log("   🎓 Alumno:   alumno1@cbtis61.edu.mx / student123");
    console.log("   👨‍👩‍👦 Padre:    padre1@email.com / parent123");
  } catch (error) {
    console.error("❌ Error en el seed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
