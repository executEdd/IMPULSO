import { Test, TestingModule } from "@nestjs/testing";
import { ClassroomsController } from "../src/classrooms/classrooms.controller";
import { ClassroomsService } from "../src/classrooms/classrooms.service";

describe("ClassroomsController", () => {
  let controller: ClassroomsController;
  let service: ClassroomsService;

  const mockClassroomsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassroomsController],
      providers: [
        { provide: ClassroomsService, useValue: mockClassroomsService },
      ],
    }).compile();

    controller = module.get<ClassroomsController>(ClassroomsController);
    service = module.get<ClassroomsService>(ClassroomsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should create a classroom", async () => {
    const dto = { name: "Aula 101" };
    mockClassroomsService.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it("should return all classrooms", async () => {
    mockClassroomsService.findAll.mockResolvedValue([{ id: 1 }]);
    const result = await controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });
});
