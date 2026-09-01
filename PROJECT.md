# Project: IMPULSO Attendance Backend Refactor

## Architecture
- **Framework**: NestJS (TypeScript) with Modular Architecture
- **Database Layer**: Prisma ORM with PostgreSQL
- **Key Modules**:
  - `backend/src/attendance/`: Attendance controller, service, DTOs, interfaces, and business logic
  - `backend/src/notifications/`: Centralized alert and notification routing
  - `backend/src/auth/`: Authentication, JWT guards, roles, and `@CurrentUser` decorators
  - `backend/prisma/`: Schema definitions and migrations
  - `backend/test/`: Unit and E2E test suites (Strict location constraint)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `AttendanceLog` Prisma Model | Audit table capturing attendance modifications (`attendanceId`, `userId`, `previousStatus`, `newStatus`, `reason`, `timestamp`) with indexes & cascading delete | M1 | ORIGINAL_REQUEST §R3 |
| 2 | Numeric `attendanceRate` | Change `attendanceRate` from `string` (`"92.50"`) to `number` (`92.5`) across all services, DTOs, and controllers | M2 | ORIGINAL_REQUEST §R1 |
| 3 | 3 LATE = 1 ABSENT Rule | Calculate effective absences as `absentCount + Math.floor(lateCount / 3)` | M2 | ORIGINAL_REQUEST §R1 |
| 4 | JUSTIFIED Non-Penalty | Justified absences do not penalize attendance percentage: `(evaluable - effectiveAbsences) / evaluable * 100` where `evaluable = totalClasses - justified` | M2 | ORIGINAL_REQUEST §R1 |
| 5 | Date-Bounded Semester Evaluation | Evaluate attendances strictly between active semester `startDate` and `todayEnd` (ignoring projected future dates) | M2 | ORIGINAL_REQUEST §R1 |
| 6 | 3-State Traffic Light Semaphore | GREEN (0-1 absence, rate >= 80%), YELLOW (2 absences OR rate < 80%), RED (>= 3 absences) | M2 | ORIGINAL_REQUEST §R1 |
| 7 | Dynamic Semaphore Recalculation | Automatically recompute and update student semaphore on mark, update, or justification (de-escalating from RED when justified) | M2 | ORIGINAL_REQUEST §R1 |
| 8 | Eliminate `any` in Service | Strict typing with Prisma types, transaction clients, and authenticated user interfaces | M2 | ORIGINAL_REQUEST §R3 |
| 9 | Dynamic Notification Sender ID | Replace hardcoded `senderId: 1` with authenticated performer or system user | M2 | ORIGINAL_REQUEST §R3 |
| 10 | Security 403 `ForbiddenException` | Return 403 Forbidden for unauthorized teacher/user access instead of 400 Bad Request | M2, M3 | ORIGINAL_REQUEST §R3 |
| 11 | `CreateAttendanceDto` Alignment | Add `classScheduleId` and align schema with actual database model requirements | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Manual Correction Endpoint | Implement `PATCH /attendance/:id/correction` requiring `status` and mandatory `reason`, writing audit log & updating semaphore | M3 | ORIGINAL_REQUEST §R2 |
| 13 | Enriched `findByStudent` Response | Include nested `classes.teacher.user`, `classes.subject`, `classes.classroom`, `classes.group`, `classSchedule.classroom`, and `logs` | M3 | ORIGINAL_REQUEST §R2 |
| 14 | Direct `classScheduleId` Filter in `findAll` | Apply filter directly on `where.classScheduleId = filters.classScheduleId` | M3 | ORIGINAL_REQUEST §R2 |
| 15 | Enriched `getStudentStats` Response | Return complete breakdown: `absences`, `present`, `late`, `justified`, `effectiveAbsences`, `totalClasses`, `attendanceRate: number`, `evaluatedPeriod` | M3 | ORIGINAL_REQUEST §R2 |
| 16 | Eliminate `any` in Controller | Replace all `@CurrentUser() user: any` with strongly-typed parameter decorators and DTOs | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Swagger / OpenAPI Annotations | Comprehensive Swagger documentation for new and modified endpoints, DTOs, and responses | M3 | ORIGINAL_REQUEST §R4 |
| 18 | Opaque-Box & Unit Test Suite in `backend/test/` | Complete 4-tier test suite covering feature tests, boundaries, combinations, and E2E scenarios | M4 | ORIGINAL_REQUEST §R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Prisma Schema & Audit Model | Add `AttendanceLog` model, relations in `User` & `Attendance`, generate Prisma client & migration | none | DONE |
| M2 | Core Business Logic & Semaphore Engine | Semester bounds, 3 LATE = 1 ABSENT, non-penalized JUSTIFIED, numeric rate, 3-state semaphore recalculation, dynamic senderId, 403 exceptions in service, eliminate `any` | M1 | DONE |
| M3 | Endpoints, DTOs, Manual Correction & Swagger | `CreateAttendanceDto`, `CorrectAttendanceDto`, `PATCH /attendance/:id/correction`, enriched `findByStudent`, direct `classScheduleId` in `findAll`, enriched stats, eliminate `any` in controller, Swagger docs | M2 | DONE |
| M4 | Comprehensive E2E & Unit Test Suite | Comprehensive tests in `backend/test/` covering all tiers (Tiers 1-4), verify 100% pass rate, build & lint verification | M3 | DONE |

## Interface Contracts

### M1 ↔ M2, M3 (Prisma Data Model)
- `AttendanceLog`:
  ```prisma
  model AttendanceLog {
    id             Int              @id @default(autoincrement())
    attendanceId   Int
    userId         Int
    previousStatus AttendanceStatus
    newStatus      AttendanceStatus
    reason         String
    timestamp      DateTime         @default(now())
    attendance     Attendance       @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
    user           User             @relation(fields: [userId], references: [id])
    @@index([attendanceId])
    @@index([userId])
    @@map("attendance_logs")
  }
  ```

### M2 ↔ M3 (Attendance Service Public Interfaces)
- `recalculateStudentSemaphore(studentId: number, tx?: Prisma.TransactionClient, senderId?: number): Promise<SemaphoreStatus>`
- `correctAttendance(id: number, dto: CorrectAttendanceDto, user: IAuthenticatedUser): Promise<AttendanceWithDetails>`
- `getStudentAbsenceCount(studentId: number): Promise<StudentAttendanceStatsResponse>`
  - Returns: `{ absences: number, present: number, late: number, justified: number, effectiveAbsences: number, totalClasses: number, attendanceRate: number, semaphore: SemaphoreStatus, evaluatedPeriod: EvaluatedPeriodDto }`

### M3 ↔ External (REST API & DTOs)
- `PATCH /api/attendance/:id/correction`
  - Body: `{ status: AttendanceStatus, reason: string, notes?: string }`
  - Status 200: Updated Attendance with `AttendanceLog` and recalculated semaphore
  - Status 400: Validation error (empty reason or invalid status)
  - Status 403: Teacher not assigned to class or unauthorized user
  - Status 404: Attendance record not found

## Code Layout
- `backend/prisma/schema.prisma` — Prisma schema definition
- `backend/prisma/migrations/` — Prisma database migrations
- `backend/src/attendance/attendance.controller.ts` — Attendance REST endpoints
- `backend/src/attendance/attendance.service.ts` — Business logic and data access
- `backend/src/attendance/dto/` — DTO definitions (`create-attendance.dto.ts`, `correct-attendance.dto.ts`, `attendance-filters.dto.ts`, etc.)
- `backend/src/attendance/interfaces/` — TypeScript interfaces for attendance and stats
- `backend/src/notifications/notification-router.service.ts` — Notification dispatch
- `backend/test/` — ALL test suites (`attendance.e2e-spec.ts`, `attendance-calculations.spec.ts`, etc.)
