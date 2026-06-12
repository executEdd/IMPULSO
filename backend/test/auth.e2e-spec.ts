import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma.service';
import { UserRole } from '../src/common/enums/roles.enum';

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testId = Date.now();

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
  });

  afterAll(async () => {
    // Clean up all users created during this test run
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `test-auth-${testId}`,
        },
      },
    });
    await app.close();
  });

  // Test Case 1: Register a student successfully
  it('1. should register a student successfully (public endpoint)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-student@example.com`,
        password: 'password123',
        firstName: 'Test',
        lastName: 'Student',
        role: UserRole.STUDENT,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Usuario registrado exitosamente');
    expect(res.body.user).toHaveProperty('email', `test-auth-${testId}-student@example.com`);
    expect(res.body.user).toHaveProperty('role', UserRole.STUDENT);
    expect(res.body.user).not.toHaveProperty('password');
  });

  // Test Case 2: Register a parent successfully
  it('2. should register a parent successfully (public endpoint)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-parent@example.com`,
        password: 'password123',
        firstName: 'Test',
        lastName: 'Parent',
        role: UserRole.PARENT,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Usuario registrado exitosamente');
    expect(res.body.user).toHaveProperty('email', `test-auth-${testId}-parent@example.com`);
    expect(res.body.user).toHaveProperty('role', UserRole.PARENT);
  });

  // Test Case 3: Fail to register with an already registered email (conflict)
  it('3. should fail to register a student with an already registered email (conflict)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-student@example.com`,
        password: 'password123',
        firstName: 'Another',
        lastName: 'Student',
        role: UserRole.STUDENT,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('El correo electrónico ya está registrado');
  });

  // Test Case 4: Fail to register a user with an invalid email format (bad request)
  it('4. should fail to register a user with an invalid email format (bad request)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'invalid-email-format',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Student',
        role: UserRole.STUDENT,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('El correo electrónico no es válido');
  });

  // Test Case 5: Fail to register a user with a short password (< 6 chars) (bad request)
  it('5. should fail to register a user with a short password (< 6 chars) (bad request)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-short@example.com`,
        password: '123',
        firstName: 'Test',
        lastName: 'Student',
        role: UserRole.STUDENT,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('La contraseña debe tener al menos 6 caracteres');
  });

  // Test Case 6: Fail to register a user with role ADMIN (forbidden)
  it('6. should fail to register a user with role ADMIN (forbidden role for public registration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-admin@example.com`,
        password: 'password123',
        firstName: 'Test',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No está permitido registrarse con este rol');
  });

  // Test Case 7: Fail to register a user with role TEACHER (forbidden)
  it('7. should fail to register a user with role TEACHER (forbidden role for public registration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-teacher@example.com`,
        password: 'password123',
        firstName: 'Test',
        lastName: 'Teacher',
        role: UserRole.TEACHER,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No está permitido registrarse con este rol');
  });

  // Test Case 8: Fail when required fields are missing
  it('8. should fail to register when required fields are missing (e.g. lastName)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `test-auth-${testId}-missing@example.com`,
        password: 'password123',
        firstName: 'Test',
        role: UserRole.STUDENT,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('El apellido es requerido');
  });

  // Test Case 9: Login successfully
  it('9. should login successfully with registered credentials and return a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: `test-auth-${testId}-student@example.com`,
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', `test-auth-${testId}-student@example.com`);
  });

  // Test Case 10: Fail to login with incorrect credentials
  it('10. should fail to login with incorrect credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: `test-auth-${testId}-student@example.com`,
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas');
  });
});
