import { Test, TestingModule } from "@nestjs/testing";
import { SchoolCyclesService } from "../src/school-cycles/school-cycles.service";
import { PrismaService } from "../src/prisma.service";
import { NotFoundException, ConflictException } from "@nestjs/common";

describe("SchoolCyclesService", () => {
  let service: SchoolCyclesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    schoolCycle: {
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
        SchoolCyclesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SchoolCyclesService>(SchoolCyclesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a school cycle", async () => {
      const createDto = {
        cycleName: "2026-2027",
        startDate: "2026-08-01T00:00:00.000Z",
        finishDate: "2027-07-31T00:00:00.000Z",
      };
      
      mockPrismaService.schoolCycle.create.mockResolvedValue({ id: 1, ...createDto });
      const result = await service.create(createDto);

      expect(prisma.schoolCycle.create).toHaveBeenCalled();
      expect(result.id).toEqual(1);
    });

    it("should throw ConflictException if start date is after finish date", async () => {
      const createDto = {
        cycleName: "2026-2027",
        startDate: "2027-08-01T00:00:00.000Z",
        finishDate: "2026-07-31T00:00:00.000Z", // finish is before start
      };
      
      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe("findOne", () => {
    it("should return a cycle if it exists", async () => {
      const expectedResult = { id: 1, cycleName: "2026-2027" };
      mockPrismaService.schoolCycle.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(1);
      expect(result).toEqual(expectedResult);
    });

    it("should throw NotFoundException if cycle does not exist", async () => {
      mockPrismaService.schoolCycle.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});

