import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "../src/users/users.service";
import { PrismaService } from "../src/prisma.service";
import { UserRole } from "../src/common/enums/roles.enum";
import { NotFoundException, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashedPassword123"),
}));

describe("UsersService - updateProfile", () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminProfile: { update: jest.fn() },
    teacherProfile: { update: jest.fn() },
    studentProfile: { update: jest.fn() },
    parentProfile: { update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it("should throw NotFoundException if user does not exist", async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);

    await expect(service.updateProfile(999, {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should throw ConflictException if new email is already taken", async () => {
    mockPrismaService.user.findUnique
      .mockResolvedValueOnce({ id: 1, email: "old@test.com", role: UserRole.STUDENT })
      .mockResolvedValueOnce({ id: 2, email: "taken@test.com" }); // existing user with that email

    await expect(
      service.updateProfile(1, { email: "taken@test.com" }),
    ).rejects.toThrow(ConflictException);
  });

  it("should update user basic data and hash password", async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 1,
      email: "old@test.com",
      role: UserRole.STUDENT,
    });
    mockPrismaService.user.update.mockResolvedValue({ id: 1 });

    const result = await service.updateProfile(1, {
      firstName: "Nuevo",
      password: "newPassword",
    });

    expect(result).toEqual({ message: "Perfil actualizado exitosamente" });
    expect(bcrypt.hash).toHaveBeenCalledWith("newPassword", 12);
    expect(mockPrismaService.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { firstName: "Nuevo", password: "hashedPassword123" },
    });
  });

  it("should update phone in the specific student profile", async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: 1,
      email: "old@test.com",
      role: UserRole.STUDENT,
    });
    mockPrismaService.studentProfile.update.mockResolvedValue({ id: 1 });

    await service.updateProfile(1, { phone: "555-1234" });

    expect(mockPrismaService.studentProfile.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { phone: "555-1234" },
    });
    // Ensure user.update was not called since only phone was provided
    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
  });
});

