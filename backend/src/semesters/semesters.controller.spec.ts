import { Test, TestingModule } from "@nestjs/testing";
import { SemestersController } from "./semesters.controller";
import { SemestersService } from "./semesters.service";

describe("SemestersController", () => {
  let controller: SemestersController;
  let service: SemestersService;

  const mockSemestersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemestersController],
      providers: [{ provide: SemestersService, useValue: mockSemestersService }],
    }).compile();

    controller = module.get<SemestersController>(SemestersController);
    service = module.get<SemestersService>(SemestersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should create a semester", async () => {
    const dto = { semesterName: "Test", startDate: "2026-08-01", finishDate: "2026-12-01", schoolCycleId: 1 };
    mockSemestersService.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it("should return all semesters", async () => {
    mockSemestersService.findAll.mockResolvedValue([{ id: 1 }]);
    const result = await controller.findAll(undefined);
    expect(service.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([{ id: 1 }]);
  });
});

