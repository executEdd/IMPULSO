import { Test, TestingModule } from "@nestjs/testing";
import { SchoolCyclesController } from "../src/school-cycles/school-cycles.controller";
import { SchoolCyclesService } from "../src/school-cycles/school-cycles.service";

describe("SchoolCyclesController", () => {
  let controller: SchoolCyclesController;
  let service: SchoolCyclesService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchoolCyclesController],
      providers: [{ provide: SchoolCyclesService, useValue: mockService }],
    }).compile();

    controller = module.get<SchoolCyclesController>(SchoolCyclesController);
    service = module.get<SchoolCyclesService>(SchoolCyclesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should create a cycle", async () => {
    const dto = {
      cycleName: "2026-2027",
      startDate: "2026-08-01T00:00:00.000Z",
      finishDate: "2027-07-31T00:00:00.000Z",
    };
    mockService.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.id).toEqual(1);
  });

  it("should return all cycles", async () => {
    mockService.findAll.mockResolvedValue([{ id: 1 }]);
    const result = await controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });
});

