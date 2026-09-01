## 2026-09-01T17:03:38Z
You are Spec Miner for Milestone 2 (Archetype: teamwork_preview_spec_miner).
Your working directory for metadata is: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\spec_miner_m2_3
Original user request path: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\ORIGINAL_REQUEST.md
Project specification: C:\Users\eflor\Documents\Develop\IMPULSO\PROJECT.md
Codebase root: C:\Users\eflor\Documents\Develop\IMPULSO
Target codebase directory: backend/

Scope for Milestone 2: Core Business Logic & Semaphore Engine
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Identify all `any` usages across `backend/src/attendance/attendance.service.ts` and map each to the strongly typed interfaces from `src/attendance/interfaces/`.
3. Map out test scenarios to be implemented in `backend/test/attendance-business-rules.spec.ts` covering:
   - 3 LATE = 1 ABSENT formula (0 late, 1 late, 2 late, 3 late = 1 penalty, 5 late = 1 penalty, 6 late = 2 penalties)
   - JUSTIFIED non-penalty behavior
   - Numeric `attendanceRate` type check
   - Semaphore state transitions (GREEN -> YELLOW -> RED, and RED -> YELLOW -> GREEN on justification)
   - Active semester date boundary cutoff
   - 403 ForbiddenException on teacher authorization mismatch
4. Document in `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\spec_miner_m2_3\handoff.md`.
5. Send a completion message to your orchestrator when done.
