import { Test, TestingModule } from "@nestjs/testing";
import { SemestersService } from "../src/semesters/semesters.service";
import { PrismaService } from "../src/prisma.service";
import { NotFoundException } from "@nestjs/common";

describe("SemestersService", () => {
  let service: SemestersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    semester: {
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
        SemestersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SemestersService>(SemestersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a semester", async () => {
      const createDto = {
        semesterName: "Test Semester",
        startDate: "2026-08-01T00:00:00.000Z",
        finishDate: "2026-12-01T00:00:00.000Z",
        schoolCycleId: 1,
      };

      const expectedResult = { id: 1, ...createDto, startDate: new Date(createDto.startDate), finishDate: new Date(createDto.finishDate) };
      mockPrismaService.semester.create.mockResolvedValue(expectedResult);

      const result = await service.create(createDto);

      expect(prisma.semester.create).toHaveBeenCalledWith({
        data: {
          semesterName: createDto.semesterName,
          startDate: new Date(createDto.startDate),
          finishDate: new Date(createDto.finishDate),
          schoolCycleId: createDto.schoolCycleId,
        },
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe("findAll", () => {
    it("should return an array of semesters", async () => {
      const expectedResult = [{ id: 1, semesterName: "Test" }];
      mockPrismaService.semester.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll();

      expect(prisma.semester.findMany).toHaveBeenCalledWith({
        where: {},
        include: { cycle: true },
        orderBy: { startDate: "desc" },
      });
      expect(result).toEqual(expectedResult);
    });

    it("should filter by schoolCycleId", async () => {
      mockPrismaService.semester.findMany.mockResolvedValue([]);
      await service.findAll(2);
      expect(prisma.semester.findMany).toHaveBeenCalledWith({
        where: { schoolCycleId: 2 },
        include: { cycle: true },
        orderBy: { startDate: "desc" },
      });
    });
  });

  describe("findOne", () => {
    it("should return a semester if it exists", async () => {
      const expectedResult = { id: 1, semesterName: "Test" };
      mockPrismaService.semester.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(1);
      expect(result).toEqual(expectedResult);
    });

    it("should throw NotFoundException if semester does not exist", async () => {
      mockPrismaService.semester.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});

