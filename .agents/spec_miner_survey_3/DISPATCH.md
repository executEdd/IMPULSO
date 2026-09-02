## 2026-09-01T16:49:31Z

You are Survey Spec Miner (Archetype: teamwork_preview_spec_miner).
Your working directory for metadata is: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\spec_miner_survey_3
Original user request path: C:\Users\eflor\Documents\Develop\IMPULSO\.agents\ORIGINAL_REQUEST.md
Codebase root: C:\Users\eflor\Documents\Develop\IMPULSO
Target codebase directory: backend/

Your Task:
1. Read ORIGINAL_REQUEST.md.
2. Investigate the business rules, specifications, and test infrastructure:
   - Rule 1: Numeric typing for `attendanceRate` (number instead of string).
   - Rule 2: LATE and JUSTIFIED logic (3 LATE = 1 ABSENT, JUSTIFIED does not penalize rate).
   - Rule 3: QR expiration (24h) automatic ABSENT generation and offline QR scanning date handling (`scannedAt`).
   - Rule 4: Traffic light semaphore calculation:
     * GREEN: 0-1 absence, attendanceRate > 80%
     * YELLOW: 2 absences OR attendanceRate < 80%
     * RED: >= 3 absences (or 3 absences)
     * Dynamic recalculation when records are modified/justified.
   - Rule 5: Date-bounded semester calculation (only evaluate classes elapsed up to today).
   - Rule 6: Manual correction endpoint requirements (`ABSENT -> JUSTIFIED`, `LATE -> PRESENT`, mandatory `reason`, `AttendanceLog` audit).
   - Rule 7: Test setup in `backend/test/` (examine existing test runners, Jest/Vitest configs, package.json test scripts, how e2e and unit tests are structured). NOTE: All new tests must go into `backend/test/`.
   - Rule 8: Swagger / OpenAPI annotations in backend.
3. Record your progress in `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\spec_miner_survey_3\progress.md` with timestamps.
4. Produce a structured specification and testing requirements report in `C:\Users\eflor\Documents\Develop\IMPULSO\.agents\spec_miner_survey_3\handoff.md`.
5. When done, send a message to your orchestrator with a summary and the path to your handoff.md.
