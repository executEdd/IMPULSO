## 2026-09-01T17:06:11Z

You are Worker 1 for Milestone 2 (Archetype: teamwork_preview_worker).
Your working directory for metadata is: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\worker_m2_1
Original user request path: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\ORIGINAL_REQUEST.md
Project specification: C:\Users\eflor\Documents\Develop\IMPULSO\PROJECT.md
Codebase root: C:\Users\eflor\Documents\Develop\IMPULSO
Target codebase directory: backend/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope for Milestone 2: Core Business Logic & Semaphore Engine
Your exclusive write ownership:
- `backend/src/attendance/attendance.service.ts`
- `backend/src/attendance/interfaces/`
- `backend/test/attendance-business-rules.spec.ts` (STRICT: all test files MUST be in backend/test/)

Instructions:
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Review Explorer reports:
   - `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\explorer_m2_1\handoff.md`
   - `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\explorer_m2_2\handoff.md`
   - `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\spec_miner_m2_3\handoff.md`
3. Update `backend/src/attendance/attendance.service.ts`:
   - Implement `resolveActiveSemester(tx?: Prisma.TransactionClient)` querying active semester (`startDate <= now <= finishDate` fallback to latest `finishDate`).
   - Implement `calculateAttendanceMetrics(attendances, semester, todayEnd)`:
     * `effectiveAbsences = absentCount + Math.floor(lateCount / 3)`
     * `evaluableClasses = totalClasses - justifiedCount`
     * `attendanceRate = evaluableClasses > 0 ? Math.round(((evaluableClasses - effectiveAbsences) / evaluableClasses) * 10000) / 100 : 100.0` (as float number)
     * Semaphore thresholds: GREEN (`effectiveAbsences <= 1 && attendanceRate >= 80`), YELLOW (`effectiveAbsences === 2 || attendanceRate < 80`), RED (`effectiveAbsences >= 3`).
   - Implement `getStudentAbsenceCount(studentId, tx)`: strictly evaluates attendances within `[semester.startDate, todayEnd]` (using CDMX timezone). Returns strongly-typed `IStudentAttendanceStats`.
   - Implement `recalculateStudentSemaphore(studentId, tx, senderId)`: updates student semaphore and triggers alerts when transitioning to RED. Supports dynamic de-escalation when transitioning from RED to YELLOW or GREEN.
   - Dynamic Notification Sender: eliminate `senderId: 1`, resolve dynamic admin or performer ID.
   - Update `markAbsent` to call `recalculateStudentSemaphore`.
   - Replace `BadRequestException` with `ForbiddenException` on permission checks (lines 209 and 392).
   - Eliminate all occurrences of `any` across `attendance.service.ts`.
4. Create unit tests in `backend/test/attendance-business-rules.spec.ts` thoroughly testing:
   - 3 LATE = 1 ABSENT rule
   - JUSTIFIED non-penalty behavior
   - Numeric `attendanceRate` float type and 2-decimal rounding
   - Dynamic semaphore transitions (GREEN -> YELLOW -> RED, and healing RED -> YELLOW -> GREEN on justification)
   - Date-bounded semester cutoff
   - 403 ForbiddenException on teacher class assignment mismatch
5. Run build, lint, and test verification in `backend/`:
   - `npm run build`
   - `npm run test`
6. Document your changes and test outputs in `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\worker_m2_1\handoff.md` and update `progress.md`.
7. Send a completion message to your orchestrator when done.
