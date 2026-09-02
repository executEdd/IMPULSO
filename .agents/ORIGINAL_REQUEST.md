# Original User Request

## 2026-09-01T16:48:40Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Complete the attendance backend refactor
> Requested team: none

Completar, refactorizar y estabilizar el backend del módulo de Asistencia (Attendance) en NestJS, alineándolo con las reglas de negocio académicas y corrigiendo deudas técnicas.

Working directory: `backend/`

## Requirements

### R1. Lógica Central y Reglas Académicas
- **Tipado numérico:** Cambiar `attendanceRate` de `string` a `number` en todos los cálculos.
- **Retardos y Justificaciones:** Implementar `LATE` y `JUSTIFIED`. Regla: 3 retardos (LATE) = 1 falta (ABSENT). Las faltas justificadas no penalizan el porcentaje.
- **Faltas automáticas y Offline:** Reforzar la lógica existente: si el código QR expira (24h) y no hubo registro, se genera un ABSENT automático. Para registros offline, respetar la fecha `scannedAt` enviada por el cliente al recuperar la conexión.
- **Semáforo de Alertas:** 
  - **VERDE:** 0-1 falta, asistencia > 80%.
  - **AMARILLO:** 2 faltas OR porcentaje de asistencia < 80%.
  - **ROJO:** 3 faltas.
  El semáforo debe recalcularse automáticamente si se corrige o justifica una falta.
- **Periodo de Cálculo:** El cálculo debe basarse en el Semestre actual del alumno, evaluando únicamente las clases transcurridas hasta el día de hoy (no el total proyectado del semestre).

### R2. Endpoints y Respuestas
- Completar la respuesta de `findByStudent()` incluyendo docente (`teacher.user`), bloque de horario, aula y relaciones completas para evitar fetch secundario en frontend.
- Mejorar estadísticas: devolver desglose completo (`absences`, `present`, `late`, `justified`, `totalClasses`, `attendanceRate` numérico, y el periodo evaluado).
- Actualizar `findAll()` para filtrar directamente por `Attendance.classScheduleId`.
- Agregar un endpoint dedicado para corrección manual de asistencias (`ABSENT -> JUSTIFIED`, `LATE -> PRESENT`) requiriendo un `reason` (motivo) obligatorio.

### R3. Calidad de Código y Deuda Técnica
- Eliminar estrictamente el uso de `any` en `attendance.controller.ts` y `attendance.service.ts`. Usar DTOs/interfaces explícitas.
- Modificar `CreateAttendanceDto` para alinear sus campos con la realidad (ej. `classScheduleId`).
- Sustituir `BadRequestException` por `ForbiddenException` en fallas de autorización.
- Crear un historial de auditoría (ej. modelo `AttendanceLog` en Prisma) que registre: usuario que modifica, estado anterior, estado nuevo, motivo y fecha.
- Eliminar el `senderId: 1` hardcodeado en notificaciones, usando un ID válido o identidad del sistema, y centralizar la emisión de alertas.

### R4. Pruebas y Documentación
- Actualizar y completar la documentación de Swagger de los endpoints modificados y creados.
- (Opcional) Implementar pruebas E2E o unitarias en `backend/test/` para validar el cálculo del semáforo y la regla de 3 retardos = 1 falta.

## Acceptance Criteria

### Lógica de Negocio
- [ ] Un alumno con 3 registros `LATE` incrementa su contador efectivo de faltas en 1 para el cálculo del semáforo y porcentaje.
- [ ] Un alumno con 1 registro `JUSTIFIED` mantiene su `attendanceRate` sin penalización por esa clase.
- [ ] El cambio manual de un registro de `ABSENT` a `JUSTIFIED` recalcula el semáforo y puede sacar al alumno del estado `RED`.
- [ ] El porcentaje de asistencia utiliza como total únicamente las clases programadas hasta la fecha actual, ignorando el futuro del semestre.

### Deuda Técnica y Auditoría
- [ ] No existen tipos `any` en los archivos modificados del módulo de asistencia.
- [ ] Al modificar manualmente una asistencia mediante el nuevo endpoint, se inserta automáticamente un registro en `AttendanceLog`.
- [ ] Las validaciones de seguridad devuelven 403 Forbidden, no 400 Bad Request.
