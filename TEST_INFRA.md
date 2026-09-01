# E2E Test Infra: IMPULSO Attendance Backend

## Test Philosophy
- Opaque-box, requirement-driven. Derives from ORIGINAL_REQUEST.md.
- **Strict Location Rule**: ALL tests MUST be placed under `backend/test/` (NEVER inside `backend/src/`).
- Test runner: Jest 29.7 with `ts-jest` 29.1.

## Feature Inventory & Test Coverage
| # | Feature | Requirement | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------|:------:|:------:|:------:|:------:|
| 1 | Numeric `attendanceRate` | R1 (number not string) | 5 | 5 | ✓ | ✓ |
| 2 | 3 LATE = 1 ABSENT rule | R1 (3 lates penalty) | 5 | 5 | ✓ | ✓ |
| 3 | JUSTIFIED non-penalty | R1 (justified doesn't drop rate) | 5 | 5 | ✓ | ✓ |
| 4 | Semester date bounds | R1 (evaluate up to today) | 5 | 5 | ✓ | ✓ |
| 5 | 3-State Semaphore (GREEN/YELLOW/RED) | R1 (deterministic thresholds) | 5 | 5 | ✓ | ✓ |
| 6 | Dynamic Semaphore recalculation | R1 (recalculates on update/justify) | 5 | 5 | ✓ | ✓ |
| 7 | `findByStudent` full relation graph | R2 (teacher.user, schedule, classroom) | 5 | 3 | ✓ | ✓ |
| 8 | Direct `classScheduleId` filter in `findAll` | R2 (direct column filter) | 5 | 3 | ✓ | ✓ |
| 9 | `getStudentStats` breakdown | R2 (absences, present, late, justified) | 5 | 5 | ✓ | ✓ |
| 10 | `PATCH /attendance/:id/correction` endpoint | R2 (status, mandatory reason) | 5 | 5 | ✓ | ✓ |
| 11 | `AttendanceLog` audit history insertion | R3 (audit record on correction) | 5 | 3 | ✓ | ✓ |
| 12 | 403 `ForbiddenException` on auth failures | R3 (403 instead of 400) | 5 | 3 | ✓ | ✓ |
| 13 | `CreateAttendanceDto` with `classScheduleId` | R3 (schema alignment) | 5 | 3 | ✓ | ✓ |

## Test Architecture
- Unit test runner: `npm run test` (executes `jest` scanning `backend/test/*.spec.ts`)
- E2E test runner: `npm run test:e2e` (executes `jest --config ./test/jest-e2e.json`)
- Target location: `backend/test/`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full student lifecycle with LATEs, ABSENTs, JUSTIFICATION and Semaphore de-escalation from RED to YELLOW/GREEN | F1, F2, F3, F5, F6, F9, F10, F11 | High |
| 2 | Teacher authorization barrier: assigned teacher corrects vs non-assigned teacher receives 403 Forbidden | F10, F12 | Medium |
| 3 | Multi-class attendance recording, direct schedule filtering, and full student history retrieval | F7, F8, F13 | Medium |
| 4 | Active semester boundary cutoff: attendances past today ignored, prior semester records segregated | F4, F5, F9 | Medium |
| 5 | Offline QR scan synchronization with historical timestamp and rate calculation | F1, F4, F5 | Medium |
