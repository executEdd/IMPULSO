import { Test, TestingModule } from "@nestjs/testing";
import { ClassroomsService } from "../src/classrooms/classrooms.service";
import { PrismaService } from "../src/prisma.service";
import { NotFoundException, ConflictException } from "@nestjs/common";

describe("ClassroomsService", () => {
  let service: ClassroomsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    classroom: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassroomsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ClassroomsService>(ClassroomsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a classroom", async () => {
      const createDto = { name: "Aula 101", capacity: 30 };
      mockPrismaService.classroom.findUnique.mockResolvedValue(null);
      mockPrismaService.classroom.create.mockResolvedValue({
        id: 1,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(prisma.classroom.create).toHaveBeenCalledWith({ data: createDto });
      expect(result).toEqual({ id: 1, ...createDto });
    });

    it("should throw ConflictException if classroom name exists", async () => {
      const createDto = { name: "Aula 101" };
      mockPrismaService.classroom.findUnique.mockResolvedValue({
        id: 1,
        name: "Aula 101",
      });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("findAll", () => {
    it("should return an array of classrooms", async () => {
      const expectedResult = [{ id: 1, name: "Aula 101" }];
      mockPrismaService.classroom.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll();

      expect(prisma.classroom.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe("findOne", () => {
    it("should return a classroom if it exists", async () => {
      const expectedResult = { id: 1, name: "Aula 101" };
      mockPrismaService.classroom.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(1);
      expect(result).toEqual(expectedResult);
    });

    it("should throw NotFoundException if classroom does not exist", async () => {
      mockPrismaService.classroom.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});
