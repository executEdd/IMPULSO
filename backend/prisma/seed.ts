import { PrismaClient, UserRole, DayOfWeek, SemaphoreStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de datos...');

  // Limpiar datos existentes
  await prisma.gradeLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.parentProfile.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.adminProfile.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  // Crear grupos
  const groups = await Promise.all([
    prisma.group.create({ data: { name: '3A - Programación', gradeLevel: 3, career: 'Programación', classroom: 'A-101', maxStudents: 35 } }),
    prisma.group.create({ data: { name: '3B - Programación', gradeLevel: 3, career: 'Programación', classroom: 'A-102', maxStudents: 35 } }),
    prisma.group.create({ data: { name: '4A - Contabilidad', gradeLevel: 4, career: 'Contabilidad', classroom: 'B-201', maxStudents: 40 } }),
    prisma.group.create({ data: { name: '5A - Electrónica', gradeLevel: 5, career: 'Electrónica', classroom: 'C-301', maxStudents: 30 } }),
    prisma.group.create({ data: { name: '6A - Mecatrónica', gradeLevel: 6, career: 'Mecatrónica', classroom: 'D-401', maxStudents: 30 } }),
  ]);

  console.log('✅ Grupos creados');

  // Crear materias
  const subjects = await Promise.all([
    prisma.subject.create({ data: { name: 'Matemáticas IV', code: 'MAT-401', description: 'Cálculo diferencial e integral', credits: 4 } }),
    prisma.subject.create({ data: { name: 'Física III', code: 'FIS-301', description: 'Electricidad y magnetismo', credits: 4 } }),
    prisma.subject.create({ data: { name: 'Programación Web', code: 'PRO-501', description: 'Desarrollo de aplicaciones web', credits: 5 } }),
    prisma.subject.create({ data: { name: 'Base de Datos', code: 'BD-401', description: 'Diseño y administración de BD', credits: 4 } }),
    prisma.subject.create({ data: { name: 'Inglés IV', code: 'ING-401', description: 'Inglés técnico', credits: 3 } }),
    prisma.subject.create({ data: { name: 'Ética Profesional', code: 'ETI-201', description: 'Valores y ética en el trabajo', credits: 2 } }),
    prisma.subject.create({ data: { name: 'Electrónica Digital', code: 'ELE-501', description: 'Circuitos digitales', credits: 5 } }),
    prisma.subject.create({ data: { name: 'Contabilidad General', code: 'CON-301', description: 'Principios de contabilidad', credits: 4 } }),
  ]);

  console.log('✅ Materias creadas');

  // Crear usuarios base
  const adminPassword = await bcrypt.hash('admin123', 12);
  const teacherPassword = await bcrypt.hash('teacher123', 12);
  const studentPassword = await bcrypt.hash('student123', 12);
  const parentPassword = await bcrypt.hash('parent123', 12);

  // Admin (Subdirector)
  const admin = await prisma.user.create({
    data: {
      email: 'subdirector@cbtis61.edu.mx',
      password: adminPassword,
      firstName: 'Carlos',
      lastName: 'Hernández López',
      role: UserRole.ADMIN,
      adminProfile: { create: { position: 'Subdirector Académico', phone: '555-0101' } },
    },
  });

  // Docentes
  const teachers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'juan.perez@cbtis61.edu.mx',
        password: teacherPassword,
        firstName: 'Juan',
        lastName: 'Pérez García',
        role: UserRole.TEACHER,
        teacherProfile: { create: { employeeId: 'DOC-001', specialty: 'Matemáticas', phone: '555-0201' } },
      },
    }),
    prisma.user.create({
      data: {
        email: 'maria.gonzalez@cbtis61.edu.mx',
        password: teacherPassword,
        firstName: 'María',
        lastName: 'González Ruiz',
        role: UserRole.TEACHER,
        teacherProfile: { create: { employeeId: 'DOC-002', specialty: 'Programación', phone: '555-0202' } },
      },
    }),
    prisma.user.create({
      data: {
        email: 'pedro.sanchez@cbtis61.edu.mx',
        password: teacherPassword,
        firstName: 'Pedro',
        lastName: 'Sánchez Torres',
        role: UserRole.TEACHER,
        teacherProfile: { create: { employeeId: 'DOC-003', specialty: 'Física', phone: '555-0203' } },
      },
    }),
    prisma.user.create({
      data: {
        email: 'ana.lopez@cbtis61.edu.mx',
        password: teacherPassword,
        firstName: 'Ana',
        lastName: 'López Martínez',
        role: UserRole.TEACHER,
        teacherProfile: { create: { employeeId: 'DOC-004', specialty: 'Inglés', phone: '555-0204' } },
      },
    }),
  ]);

  console.log('✅ Docentes creados');

  // Padres de familia
  const parents = await Promise.all([
    prisma.user.create({
      data: {
        email: 'padre1@email.com',
        password: parentPassword,
        firstName: 'Roberto',
        lastName: 'Martínez Cruz',
        role: UserRole.PARENT,
        parentProfile: { create: { phone: '555-0301', address: 'Calle Principal #123, Ciudad' } },
      },
    }),
    prisma.user.create({
      data: {
        email: 'padre2@email.com',
        password: parentPassword,
        firstName: 'Laura',
        lastName: 'Díaz Flores',
        role: UserRole.PARENT,
        parentProfile: { create: { phone: '555-0302', address: 'Av. Juárez #456, Ciudad' } },
      },
    }),
    prisma.user.create({
      data: {
        email: 'padre3@email.com',
        password: parentPassword,
        firstName: 'Fernando',
        lastName: 'Castillo Vega',
        role: UserRole.PARENT,
        parentProfile: { create: { phone: '555-0303', address: 'Calle Hidalgo #789, Ciudad' } },
      },
    }),
  ]);

  console.log('✅ Padres de familia creados');

  // Alumnos
  const students = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alumno1@cbtis61.edu.mx',
        password: studentPassword,
        firstName: 'Luis',
        lastName: 'Martínez Hernández',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: '2024-001',
            groupId: groups[0].id,
            parentId: (await prisma.parentProfile.findUnique({ where: { userId: parents[0].id } }))!.id,
            qrToken: null,
            qrExpiresAt: null,
            semaphore: SemaphoreStatus.GREEN,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'alumno2@cbtis61.edu.mx',
        password: studentPassword,
        firstName: 'Sofía',
        lastName: 'Díaz Ramírez',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: '2024-002',
            groupId: groups[0].id,
            parentId: (await prisma.parentProfile.findUnique({ where: { userId: parents[1].id } }))!.id,
            qrToken: null,
            qrExpiresAt: null,
            semaphore: SemaphoreStatus.GREEN,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'alumno3@cbtis61.edu.mx',
        password: studentPassword,
        firstName: 'Diego',
        lastName: 'Castillo Morales',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: '2024-003',
            groupId: groups[1].id,
            parentId: (await prisma.parentProfile.findUnique({ where: { userId: parents[2].id } }))!.id,
            qrToken: null,
            qrExpiresAt: null,
            semaphore: SemaphoreStatus.GREEN,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'alumno4@cbtis61.edu.mx',
        password: studentPassword,
        firstName: 'Valentina',
        lastName: 'Hernández Silva',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: '2024-004',
            groupId: groups[2].id,
            parentId: (await prisma.parentProfile.findUnique({ where: { userId: parents[0].id } }))!.id,
            qrToken: null,
            qrExpiresAt: null,
            semaphore: SemaphoreStatus.GREEN,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'alumno5@cbtis61.edu.mx',
        password: studentPassword,
        firstName: 'Mateo',
        lastName: 'García Torres',
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            enrollmentId: '2024-005',
            groupId: groups[3].id,
            parentId: (await prisma.parentProfile.findUnique({ where: { userId: parents[1].id } }))!.id,
            qrToken: null,
            qrExpiresAt: null,
            semaphore: SemaphoreStatus.GREEN,
          },
        },
      },
    }),
  ]);

  console.log('✅ Alumnos creados');

  // Asignar materias a docentes
  await prisma.subject.update({ where: { id: subjects[0].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[0].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[1].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[2].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[2].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[1].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[3].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[1].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[4].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[3].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[5].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[0].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[6].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[2].id } }))!.id } });
  await prisma.subject.update({ where: { id: subjects[7].id }, data: { teacherId: (await prisma.teacherProfile.findUnique({ where: { userId: teachers[3].id } }))!.id } });

  console.log('✅ Materias asignadas a docentes');

  // Crear horarios
  const teacherProfiles = await prisma.teacherProfile.findMany();
  const teacherMap = new Map(teacherProfiles.map(t => [t.userId, t.id]));

  await Promise.all([
    // Grupo 3A - Lunes
    prisma.schedule.create({ data: { subjectId: subjects[0].id, teacherId: teacherMap.get(teachers[0].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '07:00', endTime: '08:30', classroom: 'A-101' } }),
    prisma.schedule.create({ data: { subjectId: subjects[1].id, teacherId: teacherMap.get(teachers[2].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '08:30', endTime: '10:00', classroom: 'A-101' } }),
    prisma.schedule.create({ data: { subjectId: subjects[2].id, teacherId: teacherMap.get(teachers[1].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '10:00', endTime: '11:30', classroom: 'LAB-1' } }),
    prisma.schedule.create({ data: { subjectId: subjects[4].id, teacherId: teacherMap.get(teachers[3].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '11:30', endTime: '13:00', classroom: 'A-101' } }),

    // Grupo 3A - Martes
    prisma.schedule.create({ data: { subjectId: subjects[3].id, teacherId: teacherMap.get(teachers[1].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.TUESDAY, startTime: '07:00', endTime: '08:30', classroom: 'LAB-2' } }),
    prisma.schedule.create({ data: { subjectId: subjects[0].id, teacherId: teacherMap.get(teachers[0].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.TUESDAY, startTime: '08:30', endTime: '10:00', classroom: 'A-101' } }),
    prisma.schedule.create({ data: { subjectId: subjects[5].id, teacherId: teacherMap.get(teachers[0].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.TUESDAY, startTime: '10:00', endTime: '11:30', classroom: 'A-101' } }),
    prisma.schedule.create({ data: { subjectId: subjects[2].id, teacherId: teacherMap.get(teachers[1].id)!, groupId: groups[0].id, dayOfWeek: DayOfWeek.TUESDAY, startTime: '11:30', endTime: '13:00', classroom: 'LAB-1' } }),

    // Grupo 3B - Lunes
    prisma.schedule.create({ data: { subjectId: subjects[0].id, teacherId: teacherMap.get(teachers[0].id)!, groupId: groups[1].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '13:30', endTime: '15:00', classroom: 'A-102' } }),
    prisma.schedule.create({ data: { subjectId: subjects[1].id, teacherId: teacherMap.get(teachers[2].id)!, groupId: groups[1].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '15:00', endTime: '16:30', classroom: 'A-102' } }),

    // Grupo 4A - Lunes
    prisma.schedule.create({ data: { subjectId: subjects[7].id, teacherId: teacherMap.get(teachers[3].id)!, groupId: groups[2].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '07:00', endTime: '08:30', classroom: 'B-201' } }),
    prisma.schedule.create({ data: { subjectId: subjects[0].id, teacherId: teacherMap.get(teachers[0].id)!, groupId: groups[2].id, dayOfWeek: DayOfWeek.MONDAY, startTime: '08:30', endTime: '10:00', classroom: 'B-201' } }),
  ]);

  console.log('✅ Horarios creados');

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📋 Credenciales de prueba:');
  console.log('   Admin:    subdirector@cbtis61.edu.mx / admin123');
  console.log('   Docente:  juan.perez@cbtis61.edu.mx / teacher123');
  console.log('   Alumno:   alumno1@cbtis61.edu.mx / student123');
  console.log('   Padre:    padre1@email.com / parent123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
