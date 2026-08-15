import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  DayOfWeek,
  SemaphoreStatus,
  GradeStatus,
  AttendanceStatus,
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
      await tx.pushSubscription.deleteMany();
      await tx.notificationPreference.deleteMany();
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
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS push_subscriptions_id_seq RESTART WITH 1;');
      await tx.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS notification_preferences_id_seq RESTART WITH 1;');

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
        { name: "B-202", capacity: 40, description: "Aula del Edificio B" },
        { name: "C-301", capacity: 40, description: "Aula del Edificio C" },
        { name: "C-302", capacity: 40, description: "Aula del Edificio C" },
        { name: "D-401", capacity: 40, description: "Aula del Edificio D" },
        { name: "D-402", capacity: 40, description: "Aula del Edificio D" },
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
        { name: "4B - Contabilidad", gradeLevel: 4, career: "Contabilidad" },
        { name: "5A - Electrónica", gradeLevel: 5, career: "Electrónica" },
        { name: "5B - Electrónica", gradeLevel: 5, career: "Electrónica" },
        { name: "6A - Mecatrónica", gradeLevel: 6, career: "Mecatrónica" },
        { name: "6B - Mecatrónica", gradeLevel: 6, career: "Mecatrónica" },
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
        { name: "Contabilidad de Costos", code: "CON-302", description: "Costos y presupuestos", credits: 4 },
        { name: "Electrónica Analógica", code: "ELE-502", description: "Análisis de circuitos analógicos", credits: 5 },
        { name: "Automatización", code: "AUT-601", description: "Sistemas automatizados industriales", credits: 5 },
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
        {
          email: "carlos.ruiz@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "Carlos",
          lastName: "Ruiz Hernández",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-005", specialty: "Contabilidad", phone: "555-0205" },
          },
        },
        {
          email: "elena.vargas@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "Elena",
          lastName: "Vargas Soto",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-006", specialty: "Electrónica", phone: "555-0206" },
          },
        },
        {
          email: "diego.morales@cbtis61.edu.mx",
          password: teacherPassword,
          firstName: "Diego",
          lastName: "Morales Flores",
          role: UserRole.TEACHER,
          teacherProfile: {
            create: { employeeId: "DOC-007", specialty: "Mecatrónica", phone: "555-0207" },
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
        {
          email: "padre4@email.com",
          password: parentPassword,
          firstName: "Patricia",
          lastName: "Mendoza Ruiz",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0304", address: "Av. Reforma #321, Ciudad" },
          },
        },
        {
          email: "padre5@email.com",
          password: parentPassword,
          firstName: "Jorge",
          lastName: "Hernández Luna",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0305", address: "Calle Madero #555, Ciudad" },
          },
        },
        {
          email: "padre6@email.com",
          password: parentPassword,
          firstName: "Carmen",
          lastName: "Ortiz Pérez",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0306", address: "Av. Hidalgo #777, Ciudad" },
          },
        },
        {
          email: "padre7@email.com",
          password: parentPassword,
          firstName: "Miguel",
          lastName: "Torres Díaz",
          role: UserRole.PARENT,
          parentProfile: {
            create: { phone: "555-0307", address: "Calle Juárez #999, Ciudad" },
          },
        },
      ]) {
        parents.push(await tx.user.create({ data: p }));
      }
      console.log("Padres de familia creados");

      // Alumnos
      // Distribución pensada para que varios padres tengan hijos en 3A y 3B,
      // facilitando pruebas de notificaciones agrupadas por familia.
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
              groupId: groups[0].id, // 3A
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
              groupId: groups[0].id, // 3A
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
          lastName: "Martínez Morales",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-003",
              groupId: groups[1].id, // 3B - hermano de alumno1
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[0].id } }))!.id,
              phone: "246-100-0003",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno4@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Valentina",
          lastName: "Díaz Silva",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-004",
              groupId: groups[1].id, // 3B - hermana de alumno2
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[1].id } }))!.id,
              phone: "246-100-0004",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno5@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Mateo",
          lastName: "Castillo Torres",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-005",
              groupId: groups[0].id, // 3A
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[2].id } }))!.id,
              phone: "246-100-0005",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno6@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Isabella",
          lastName: "Castillo Reyes",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-006",
              groupId: groups[1].id, // 3B - hermana de alumno5
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[2].id } }))!.id,
              phone: "246-100-0006",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno7@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Sebastián",
          lastName: "Mendoza López",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-007",
              groupId: groups[2].id, // 4A
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[3].id } }))!.id,
              phone: "246-100-0007",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno8@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Camila",
          lastName: "Mendoza López",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-008",
              groupId: groups[4].id, // 5A
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[3].id } }))!.id,
              phone: "246-100-0008",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno9@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Daniel",
          lastName: "Hernández Ruiz",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-009",
              groupId: groups[3].id, // 4B
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[4].id } }))!.id,
              phone: "246-100-0009",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno10@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Mariana",
          lastName: "Ortiz Soto",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-010",
              groupId: groups[3].id, // 4B - hermana de alumno9
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[5].id } }))!.id,
              phone: "246-100-0010",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno11@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Andrés",
          lastName: "Ortiz Vargas",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-011",
              groupId: groups[5].id, // 5B - hermano de alumno10
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[5].id } }))!.id,
              phone: "246-100-0011",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno12@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Paula",
          lastName: "Torres Vega",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-012",
              groupId: groups[5].id, // 5B
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[6].id } }))!.id,
              phone: "246-100-0012",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno13@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Emilio",
          lastName: "Torres Morales",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-013",
              groupId: groups[7].id, // 6B - hermano de alumno12
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[6].id } }))!.id,
              phone: "246-100-0013",
              semaphore: SemaphoreStatus.GREEN,
            },
          },
        },
        {
          email: "alumno14@cbtis61.edu.mx",
          password: studentPassword,
          firstName: "Renata",
          lastName: "Hernández Luna",
          role: UserRole.STUDENT,
          studentProfile: {
            create: {
              enrollmentId: "2024-014",
              groupId: groups[7].id, // 6B - hermana de alumno9
              parentId: (await tx.parentProfile.findUnique({ where: { userId: parents[4].id } }))!.id,
              phone: "246-100-0014",
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
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[5].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[7].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[4].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[8].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[4].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[9].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[5].id } }))!.id },
      });
      await tx.subject.update({
        where: { id: subjects[10].id },
        data: { teacherId: (await tx.teacherProfile.findUnique({ where: { userId: teachers[6].id } }))!.id },
      });
      console.log("Materias asignadas a docentes");

      // Clases y Horarios (lunes a viernes)
      const teacherProfiles = await tx.teacherProfile.findMany();
      const teacherMap = new Map(teacherProfiles.map((t) => [t.userId, t.id]));

      const daysOfWeek = [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
      ];

      const timeSlots = [
        { start: "07:00", end: "08:30" },
        { start: "08:30", end: "10:00" },
        { start: "10:00", end: "11:30" },
        { start: "11:30", end: "13:00" },
        { start: "13:00", end: "14:30" },
        { start: "14:30", end: "16:00" },
      ];

      // Materias compartidas entre 3A y 3B (mismo grado/carrera, mismos maestros)
      const programmingSubjects = [
        { subjectId: subjects[0].id, teacherId: teacherMap.get(teachers[0].id)!, slotIndex: 0, classroom: "A-101" }, // Matemáticas IV
        { subjectId: subjects[1].id, teacherId: teacherMap.get(teachers[2].id)!, slotIndex: 1, classroom: "A-101" }, // Física III
        { subjectId: subjects[2].id, teacherId: teacherMap.get(teachers[1].id)!, slotIndex: 2, classroom: "LAB-1" }, // Programación Web
        { subjectId: subjects[4].id, teacherId: teacherMap.get(teachers[3].id)!, slotIndex: 3, classroom: "A-101" }, // Inglés IV
        { subjectId: subjects[3].id, teacherId: teacherMap.get(teachers[1].id)!, slotIndex: 4, classroom: "LAB-2" }, // Base de Datos
        { subjectId: subjects[5].id, teacherId: teacherMap.get(teachers[0].id)!, slotIndex: 5, classroom: "A-101" }, // Ética Profesional
      ];

      // Definición de las clases por grupo (aula base para cada grupo)
      const classDefinitions: Array<{
        subjectId: number;
        teacherId: number;
        groupId: number;
        semesterId: number;
        classroomId: number;
        slotIndex: number;
      }> = [];

      // 3A - Programación (A-101)
      for (const s of programmingSubjects) {
        classDefinitions.push({
          subjectId: s.subjectId,
          teacherId: s.teacherId,
          groupId: groups[0].id,
          semesterId: semester.id,
          classroomId: classroomMap.get(s.classroom)!,
          slotIndex: s.slotIndex,
        });
      }

      // 3B - Programación (A-102): mismas materias, maestros y horarios que 3A, aula distinta
      for (const s of programmingSubjects) {
        const classroom3B = s.classroom === "LAB-1" ? "LAB-1" : s.classroom === "LAB-2" ? "LAB-2" : "A-102";
        classDefinitions.push({
          subjectId: s.subjectId,
          teacherId: s.teacherId,
          groupId: groups[1].id,
          semesterId: semester.id,
          classroomId: classroomMap.get(classroom3B)!,
          slotIndex: s.slotIndex,
        });
      }

      // 4A - Contabilidad (B-201)
      classDefinitions.push(
        {
          subjectId: subjects[7].id,
          teacherId: teacherMap.get(teachers[4].id)!,
          groupId: groups[2].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("B-201")!,
          slotIndex: 0,
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[2].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("B-201")!,
          slotIndex: 1,
        }
      );

      // 4B - Contabilidad (B-202)
      classDefinitions.push(
        {
          subjectId: subjects[7].id,
          teacherId: teacherMap.get(teachers[4].id)!,
          groupId: groups[3].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("B-202")!,
          slotIndex: 0,
        },
        {
          subjectId: subjects[8].id,
          teacherId: teacherMap.get(teachers[4].id)!,
          groupId: groups[3].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("B-202")!,
          slotIndex: 1,
        }
      );

      // 5A - Electrónica (C-301)
      classDefinitions.push(
        {
          subjectId: subjects[6].id,
          teacherId: teacherMap.get(teachers[5].id)!,
          groupId: groups[4].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("C-301")!,
          slotIndex: 0,
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[4].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("C-301")!,
          slotIndex: 1,
        },
        {
          subjectId: subjects[1].id,
          teacherId: teacherMap.get(teachers[2].id)!,
          groupId: groups[4].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("C-301")!,
          slotIndex: 2,
        }
      );

      // 5B - Electrónica (C-302)
      classDefinitions.push(
        {
          subjectId: subjects[9].id,
          teacherId: teacherMap.get(teachers[5].id)!,
          groupId: groups[5].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("C-302")!,
          slotIndex: 0,
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[5].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("C-302")!,
          slotIndex: 1,
        },
        {
          subjectId: subjects[1].id,
          teacherId: teacherMap.get(teachers[2].id)!,
          groupId: groups[5].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("C-302")!,
          slotIndex: 2,
        }
      );

      // 6A - Mecatrónica (D-401)
      classDefinitions.push(
        {
          subjectId: subjects[6].id,
          teacherId: teacherMap.get(teachers[5].id)!,
          groupId: groups[6].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("D-401")!,
          slotIndex: 0,
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[6].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("D-401")!,
          slotIndex: 1,
        },
        {
          subjectId: subjects[1].id,
          teacherId: teacherMap.get(teachers[2].id)!,
          groupId: groups[6].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("D-401")!,
          slotIndex: 2,
        }
      );

      // 6B - Mecatrónica (D-402)
      classDefinitions.push(
        {
          subjectId: subjects[10].id,
          teacherId: teacherMap.get(teachers[6].id)!,
          groupId: groups[7].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("D-402")!,
          slotIndex: 0,
        },
        {
          subjectId: subjects[0].id,
          teacherId: teacherMap.get(teachers[0].id)!,
          groupId: groups[7].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("D-402")!,
          slotIndex: 1,
        },
        {
          subjectId: subjects[1].id,
          teacherId: teacherMap.get(teachers[2].id)!,
          groupId: groups[7].id,
          semesterId: semester.id,
          classroomId: classroomMap.get("D-402")!,
          slotIndex: 2,
        }
      );

      // Crear cada clase con sus horarios (uno por día, en el mismo bloque)
      for (const def of classDefinitions) {
        const slot = timeSlots[def.slotIndex];
        await tx.class.create({
          data: {
            subjectId: def.subjectId,
            teacherId: def.teacherId,
            groupId: def.groupId,
            semesterId: def.semesterId,
            classroomId: def.classroomId,
            schedules: {
              create: daysOfWeek.map((day) => ({
                dayOfWeek: day,
                startTime: slot.start,
                endTime: slot.end,
                classroomId: def.classroomId,
              })),
            },
          },
        });
      }
      console.log("Clases y Horarios creados (lunes a viernes)");

      // Calificaciones Iniciales
      const allStudents = await tx.studentProfile.findMany({
        include: { user: true },
      });

      function clamp(num: number, min: number, max: number) {
        return Math.min(max, Math.max(min, num));
      }

      function generatePartials(final: number) {
        return {
          partial1: clamp(Number((final - 0.4 + Math.random() * 0.8).toFixed(1)), 0, 10),
          partial2: clamp(Number((final - 0.2 + Math.random() * 0.6).toFixed(1)), 0, 10),
          partial3: clamp(Number((final - 0.1 + Math.random() * 0.5).toFixed(1)), 0, 10),
        };
      }

      const gradeOverrides: Record<string, number[]> = {
        "alumno1@cbtis61.edu.mx": [8.5, 7.8, 9.5, 8.7, 10.0, 9.0],
        "alumno2@cbtis61.edu.mx": [9.0, 8.5, 9.2, 8.8, 9.7, 9.5],
        "alumno3@cbtis61.edu.mx": [8.0, 8.3, 9.0, 8.5, 9.5, 8.8],
        "alumno4@cbtis61.edu.mx": [8.7, 8.0, 9.3, 8.6, 9.8, 9.2],
        "alumno5@cbtis61.edu.mx": [7.5, 7.0, 8.5, 8.0, 8.8, 8.2],
        "alumno6@cbtis61.edu.mx": [8.2, 7.9, 8.8, 8.4, 9.3, 8.9],
        "alumno7@cbtis61.edu.mx": [8.5, 9.0],
        "alumno8@cbtis61.edu.mx": [8.5, 9.0, 7.8],
        "alumno9@cbtis61.edu.mx": [8.0, 8.5],
        "alumno10@cbtis61.edu.mx": [8.7, 9.0],
        "alumno11@cbtis61.edu.mx": [8.5, 9.0, 7.8],
        "alumno12@cbtis61.edu.mx": [8.0, 8.5, 8.8],
        "alumno13@cbtis61.edu.mx": [8.5, 9.0, 7.8],
        "alumno14@cbtis61.edu.mx": [8.0, 8.5, 8.8],
      };

      const groupSubjects = new Map<number, number[]>();
      groupSubjects.set(groups[0].id, [subjects[0], subjects[1], subjects[2], subjects[3], subjects[4], subjects[5]].map((s) => s.id));
      groupSubjects.set(groups[1].id, [subjects[0], subjects[1], subjects[2], subjects[3], subjects[4], subjects[5]].map((s) => s.id));
      groupSubjects.set(groups[2].id, [subjects[7], subjects[0]].map((s) => s.id));
      groupSubjects.set(groups[3].id, [subjects[7], subjects[8]].map((s) => s.id));
      groupSubjects.set(groups[4].id, [subjects[6], subjects[0], subjects[1]].map((s) => s.id));
      groupSubjects.set(groups[5].id, [subjects[9], subjects[0], subjects[1]].map((s) => s.id));
      groupSubjects.set(groups[6].id, [subjects[6], subjects[0], subjects[1]].map((s) => s.id));
      groupSubjects.set(groups[7].id, [subjects[10], subjects[0], subjects[1]].map((s) => s.id));

      const gradeData = [];
      for (const student of allStudents) {
        const subjectIds = groupSubjects.get(student.groupId) || [];
        const grades = gradeOverrides[student.user.email] || subjectIds.map(() => 8.0);

        for (let i = 0; i < subjectIds.length; i++) {
          const final = grades[i] ?? 8.0;
          let status: GradeStatus = GradeStatus.REGULAR;
          if (final >= 9.0) status = GradeStatus.EXCELLENT;
          else if (final < 6.0) status = GradeStatus.IRREGULAR;

          const partials = generatePartials(final);

          gradeData.push({
            studentId: student.id,
            subjectId: subjectIds[i],
            ...partials,
            finalGrade: final,
            status,
            period: "2025-2026A",
          });
        }
      }

      if (gradeData.length > 0) {
        await tx.grade.createMany({ data: gradeData, skipDuplicates: true });
        console.log(`Calificaciones iniciales creadas para ${allStudents.length} alumnos`);
      }

      // Asistencias semilla para probar alertas y semáforo
      const mathClass3A = await tx.class.findFirst({
        where: { groupId: groups[0].id, subjectId: subjects[0].id },
        include: { schedules: true },
      });
      const mathClass3B = await tx.class.findFirst({
        where: { groupId: groups[1].id, subjectId: subjects[0].id },
        include: { schedules: true },
      });
      const accountingClass4B = await tx.class.findFirst({
        where: { groupId: groups[3].id, subjectId: subjects[7].id },
        include: { schedules: true },
      });

      function getRecentDateForDay(dayOfWeek: DayOfWeek): Date {
        const dayMap: Record<DayOfWeek, number> = {
          MONDAY: 1,
          TUESDAY: 2,
          WEDNESDAY: 3,
          THURSDAY: 4,
          FRIDAY: 5,
          SATURDAY: 6,
          SUNDAY: 0,
        };
        const targetDay = dayMap[dayOfWeek];
        const today = new Date();
        const diff = (today.getDay() - targetDay + 7) % 7;
        const date = new Date(today);
        date.setDate(today.getDate() - diff);
        date.setHours(12, 0, 0, 0);
        return date;
      }

      const studentProfileMap = new Map(allStudents.map((s) => [s.user.email, s]));

      async function seedAbsences(studentEmail: string, cls: typeof mathClass3A, count: number) {
        const student = studentProfileMap.get(studentEmail);
        if (!student || !cls) return;
        const schedules = cls.schedules.slice(0, count);
        for (const schedule of schedules) {
          await tx.attendance.create({
            data: {
              studentId: student.id,
              classId: cls.id,
              classScheduleId: schedule.id,
              date: getRecentDateForDay(schedule.dayOfWeek),
              status: AttendanceStatus.ABSENT,
              notes: "Falta semilla para pruebas de alerta",
            },
          });
        }
      }

      await seedAbsences("alumno1@cbtis61.edu.mx", mathClass3A, 3); // activa semáforo rojo
      await seedAbsences("alumno3@cbtis61.edu.mx", mathClass3B, 2); // cerca del umbral
      await seedAbsences("alumno9@cbtis61.edu.mx", accountingClass4B, 2); // alerta en 4B

      // Reflejar el semáforo rojo para el alumno con 3 faltas
      const seedAlertStudent = studentProfileMap.get("alumno1@cbtis61.edu.mx");
      if (seedAlertStudent) {
        await tx.studentProfile.update({
          where: { id: seedAlertStudent.id },
          data: { semaphore: SemaphoreStatus.RED },
        });
      }

      console.log("Asistencias semilla creadas");
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
