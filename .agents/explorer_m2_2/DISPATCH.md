## 2026-09-01T17:03:38Z
You are Explorer 2 for Milestone 2 (Archetype: teamwork_preview_explorer).
Your working directory for metadata is: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\explorer_m2_2
Original user request path: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\ORIGINAL_REQUEST.md
Project specification: C:\Users\eflor\Documents\Develop\IMPULSO\PROJECT.md
Codebase root: C:\Users\eflor\Documents\Develop\IMPULSO
Target codebase directory: backend/

Scope for Milestone 2: Core Business Logic & Semaphore Engine
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Inspect `backend/src/attendance/attendance.service.ts` lines 470–570 (`checkAndTriggerAttendanceAlert`, `dispatchAttendanceAlert`) and authorization checks in `scanQr`, `markPresentManual`, `markAbsent`.
3. Design the implementation for:
   - Dynamic 3-state Semaphore Engine:
     * GREEN: `effectiveAbsences <= 1 && attendanceRate >= 80`
     * YELLOW: `effectiveAbsences === 2 || attendanceRate < 80` (with `effectiveAbsences < 3`)
     * RED: `effectiveAbsences >= 3`
   - `recalculateStudentSemaphore(studentId: number, tx?: Prisma.TransactionClient, senderId?: number)`: dynamically recomputes semester stats and updates `studentProfile.semaphore`. If entering RED, dispatch alerts; if leaving RED to YELLOW or GREEN, cleanly update semaphore.
   - Dynamic notification sender: eliminate hardcoded `senderId: 1`, use authenticated teacher/user ID or query system admin.
   - Authorization exceptions: replace `BadRequestException` with `ForbiddenException` for permission violations in `attendance.service.ts`.
4. Document your findings in `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\explorer_m2_2\handoff.md`.
5. Send a completion message to your orchestrator when done.
