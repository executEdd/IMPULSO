## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

# Reglas del agente — IMPULSO

## 1. Propósito

IMPULSO es un sistema de gestión académica desarrollado para CBTIS 61.

El objetivo del agente es ayudar a analizar, diseñar, implementar, depurar
y mejorar el sistema respetando la arquitectura, decisiones y convenciones
existentes del proyecto.

El agente debe priorizar:

1. Comprender antes de modificar.
2. Mantener la arquitectura existente.
3. Realizar cambios pequeños y controlados.
4. Evitar complejidad innecesaria.
5. Explicar sus decisiones cuando sean relevantes.

---

## 2. Autorización de cambios — REGLA CRÍTICA

El agente NO debe realizar cambios en el repositorio sin autorización
verbal explícita del usuario.

El agente puede, sin autorización:

- Inspeccionar archivos.
- Inspeccionar la estructura del repositorio.
- Leer y analizar código.
- Analizar configuraciones.
- Revisar la arquitectura.
- Identificar errores.
- Identificar riesgos.
- Identificar deuda técnica.
- Proponer soluciones.
- Proponer refactorizaciones.
- Proponer cambios arquitectónicos.
- Explicar qué archivos deberían modificarse.
- Mostrar código o parches como propuesta.

El agente NO puede, sin autorización:

- Crear archivos.
- Modificar archivos.
- Eliminar archivos.
- Renombrar archivos.
- Mover archivos.
- Modificar código existente.
- Modificar configuraciones.
- Instalar dependencias.
- Eliminar dependencias.
- Actualizar dependencias.
- Modificar el esquema de la base de datos.
- Crear migraciones.
- Modificar migraciones existentes.
- Ejecutar comandos que modifiquen el estado del proyecto.
- Crear commits.
- Hacer push.
- Crear o modificar ramas.
- Realizar cambios en servicios externos.
- Correr comandos

Una propuesta, sugerencia o análisis del agente NO constituye autorización.

La autorización debe ser explícita. Ejemplos válidos:

- "hazlo"
- "implementa eso"
- "aplica los cambios"
- "adelante"
- "sí, implementalo"
- "puedes modificarlo"

Si existe duda sobre si el usuario autorizó un cambio, el agente debe
preguntar antes de modificar el repositorio.

### Alcance de la autorización

La autorización para una tarea específica solamente permite realizar los
cambios necesarios para cumplir esa tarea.

No autoriza automáticamente:

- Refactorizaciones adicionales.
- Mejoras no solicitadas.
- Cambios arquitectónicos independientes.
- Actualización de dependencias.
- Limpieza general del código.
- Cambios en otros módulos no relacionados.

Si durante la implementación aparece una mejora adicional que no es
necesaria para cumplir la tarea, debe proponerse por separado.

---

## 3. Alcance del trabajo — Backend

Actualmente, el trabajo principal del usuario en IMPULSO es el desarrollo
del backend.

El agente debe asumir que su área de trabajo por defecto es el backend.

El backend es el área de responsabilidad actual del usuario.

El agente puede inspeccionar el frontend cuando sea necesario para:

- Comprender contratos entre frontend y backend.
- Revisar endpoints consumidos.
- Comprender modelos o estructuras de datos.
- Comprender flujos de la aplicación.
- Analizar problemas de integración.
- Verificar compatibilidad.

Sin embargo, el agente NO debe modificar ningún archivo del frontend sin
autorización explícita del usuario.

Esto incluye:

- Componentes de Angular.
- Servicios.
- Guards.
- Interceptors.
- Rutas.
- Templates.
- Estilos.
- Configuración de Angular.
- Dependencias del frontend.
- Tests del frontend.
- Cualquier otro archivo dentro de `frontend/`.

Si una tarea de backend requiere potencialmente cambios en el frontend,
el agente debe:

1. Identificar qué cambio sería necesario.
2. Explicar por qué el frontend se vería afectado.
3. Proponer el cambio.
4. Esperar autorización explícita antes de modificarlo.

La autorización para realizar una tarea de backend NO implica autorización
para modificar el frontend.

El frontend requiere autorización explícita y específica.

Por defecto:

- `backend/` → área principal de trabajo.
- `frontend/` → solamente puede modificarse con autorización explícita.

---

## 4. Comprender antes de modificar

Antes de implementar una tarea autorizada, el agente debe:

1. Inspeccionar la implementación existente.
2. Identificar los módulos involucrados.
3. Revisar las abstracciones existentes.
4. Revisar cómo se resuelve actualmente un problema similar.
5. Identificar posibles efectos secundarios.
6. Determinar el cambio mínimo necesario.

No debe asumir que una implementación es incorrecta solamente porque
existe una alternativa que considera más elegante.

---

## 5. Principio de mínima modificación

Cuando una tarea requiera cambios, realizar la menor cantidad de cambios
necesaria para resolverla correctamente.

Evitar:

- Refactorizaciones no necesarias.
- Cambios de estilo masivos.
- Renombrados innecesarios.
- Reestructuración de carpetas.
- Creación de abstracciones prematuras.
- Cambios en módulos no relacionados.

El código existente debe conservarse cuando funciona correctamente y no
sea necesario modificarlo para cumplir la tarea.

---

## 6. Arquitectura del proyecto

El proyecto está dividido principalmente en:

- `backend/` — API y lógica de negocio.
- `frontend/` — aplicación web.
- `backend/prisma/` — esquema, migraciones y seed de Prisma.
- `backend/src/` — código fuente del backend.
- `.agents/` — skills y conocimiento para agentes.
- `.opencode/` — configuración de OpenCode.
- `.claude/` — configuración relacionada con Claude.
- `docker-compose.yml` — infraestructura local.

No reorganizar esta estructura sin autorización explícita.

No introducir una arquitectura diferente solamente por preferencia
personal del agente.

---

## 7. Backend

El backend utiliza principalmente:

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- JWT
- Passport
- class-validator
- Swagger
- Docker

El backend sigue una arquitectura modular basada en NestJS.

Entre los módulos existentes se encuentran:

- `auth`
- `users`
- `attendance`
- `classes`
- `groups`
- `grades`
- `subjects`
- `schedules`
- `notifications`

Al implementar nuevas funcionalidades:

- Respetar la estructura modular existente.
- Mantener la lógica de negocio fuera de los controllers cuando sea
  apropiado.
- Reutilizar servicios y utilidades existentes.
- Evitar duplicar lógica.
- No crear abstracciones innecesarias.

Antes de crear un nuevo módulo, servicio o utilidad, comprobar si ya
existe una implementación reutilizable.

---

## 8. Frontend

El frontend utiliza principalmente:

- Angular
- TypeScript
- Angular Material
- Angular CDK
- RxJS

El frontend está fuera del alcance normal del trabajo del agente.

Puede inspeccionarse cuando sea necesario para comprender la integración
con el backend, pero NO debe modificarse sin autorización explícita del
usuario.

Cuando una tarea requiera cambios tanto en backend como en frontend, el
agente debe tratar ambos alcances por separado.

Debe:

1. Analizar primero el impacto en el frontend.
2. Explicar qué cambios serían necesarios.
3. Esperar autorización explícita para modificarlo.

No introducir frameworks, librerías, sistemas de estado o cambios
arquitectónicos en el frontend sin autorización explícita.

---

## 9. Base de datos

Prisma es la capa de acceso a datos del backend.

Reglas:

- No modificar el esquema de Prisma sin autorización.
- No crear migraciones sin autorización.
- No modificar migraciones existentes sin autorización.
- No eliminar datos.
- No ejecutar comandos destructivos sobre la base de datos.
- No cambiar relaciones, restricciones o tipos sin analizar primero su
  impacto.
- Respetar las convenciones existentes del esquema.

Antes de proponer cambios en la base de datos, revisar el esquema actual
y las relaciones involucradas.

Nunca solucionar un problema de datos modificando directamente la base
de datos cuando la solución correcta deba estar representada en Prisma.

---

## 10. Autenticación y seguridad

La autenticación, autorización, contraseñas, tokens, cookies,
credenciales, variables de entorno y datos de estudiantes deben tratarse
como información sensible.

Nunca:

- Exponer secretos.
- Imprimir credenciales.
- Commitear archivos `.env`.
- Exponer contraseñas en respuestas de API.
- Desactivar autenticación para facilitar pruebas.
- Desactivar autorización para evitar errores.
- Debilitar validaciones de seguridad.
- Eliminar mecanismos de protección sin autorización.

No modificar el comportamiento de seguridad sin explicar previamente
el impacto.

---

## 11. Dependencias

No agregar, eliminar ni actualizar dependencias sin autorización.

Antes de proponer una nueva dependencia:

1. Comprobar si el proyecto ya dispone de una solución equivalente.
2. Explicar qué problema resuelve.
3. Explicar por qué la solución existente no es suficiente.
4. Considerar el costo y mantenimiento adicional.

Preferir las dependencias que ya forman parte del proyecto.

---

## 12. Código existente

No reescribir código funcional solamente para adaptarlo a preferencias
personales.

Al modificar código existente:

- Mantener el comportamiento actual cuando sea posible.
- Cambiar únicamente lo necesario.
- Mantener compatibilidad con el resto del sistema.
- Evitar efectos secundarios.
- Respetar las convenciones existentes.
- Reutilizar código existente cuando sea apropiado.

No cambiar contratos públicos, endpoints, estructuras de respuesta o
nombres utilizados por otras partes del sistema sin analizar primero
sus dependencias.

---

## 13. Decisiones arquitectónicas

No introducir automáticamente:

- Microservicios.
- Event-driven architecture.
- Nuevos sistemas de caché.
- Nuevas capas de abstracción.
- Nuevos patrones arquitectónicos.
- Nuevos sistemas de estado.
- Nuevas bases de datos.
- Nuevos servicios externos.

Una solución técnicamente más compleja no es necesariamente una mejor
solución.

Cuando existan varias alternativas, priorizar:

1. La solución más simple.
2. La solución compatible con la arquitectura existente.
3. La solución que requiera menos cambios.
4. La solución que introduzca menos dependencias.
5. La solución que sea fácil de mantener.

---

## 14. Investigación y propuestas

Cuando el usuario solicite investigar, analizar o revisar algo, el agente
debe limitarse al análisis si no existe autorización para implementar.

Una respuesta de análisis debe diferenciar claramente entre:

- Estado actual.
- Problema detectado.
- Causa probable.
- Opciones disponibles.
- Recomendación.
- Cambios necesarios para implementar la recomendación.

El agente puede recomendar una solución aunque no tenga autorización para
implementarla.

---

## 15. Manejo de ambigüedad

Si una solicitud tiene varias interpretaciones posibles y la diferencia
puede afectar significativamente la implementación, el agente debe
preguntar antes de modificar.

No inventar requisitos.

No asumir decisiones de negocio.

No asumir que una mejora es deseada solamente porque técnicamente parece
conveniente.

Si la ambigüedad no afecta materialmente la solución, utilizar el
comportamiento existente del proyecto como referencia.

---

## 16. Pruebas y verificación

Después de realizar un cambio autorizado, verificar la funcionalidad
afectada.

**Restricción Crítica de Ubicación**:
TODOS los archivos de pruebas (`*.spec.ts`, `*.e2e-spec.ts`, unitarias y E2E)
DEBEN colocarse dentro del directorio `backend/test/`. NUNCA los generes ni los ubiques dentro de `backend/src/`.

### Backend

Utilizar cuando corresponda:

- `npm run lint`
- `npm run test`
- `npm run build`

### Frontend

El frontend solamente puede verificarse o modificarse dentro del alcance
autorizado por el usuario.

Utilizar cuando corresponda:

- `npm test`
- `npm run build`

Utilizar las pruebas más relevantes para el cambio realizado.

No modificar código únicamente para hacer que una prueba pase sin
investigar primero la causa del fallo.

Si una prueba, lint o build falla y el problema no está relacionado con
el cambio realizado, informarlo claramente.

No ocultar errores.

---

## 17. Comandos

Los comandos que solamente leen o inspeccionan información pueden
utilizarse durante el análisis.

Los comandos que puedan:

- Modificar archivos.
- Instalar dependencias.
- Eliminar dependencias.
- Alterar la base de datos.
- Crear migraciones.
- Modificar infraestructura.
- Crear commits.
- Hacer push.
- Publicar cambios.

requieren autorización.

Ante la duda sobre si un comando puede producir cambios, no ejecutarlo
hasta confirmar.

---

## 18. Comunicación

Antes de implementar una tarea autorizada que implique varios cambios,
informar brevemente:

- Qué se va a modificar.
- Qué módulos o archivos están involucrados.
- Qué enfoque se utilizará.
- Riesgos relevantes, si existen.

Después de implementar:

- Indicar qué se modificó.
- Indicar qué se verificó.
- Indicar qué pruebas se ejecutaron.
- Indicar cualquier problema pendiente.

No ocultar cambios realizados.

---

## 19. Cambios fuera del alcance

Si durante una tarea se detectan problemas que no son necesarios para
resolverla:

No solucionarlos automáticamente.

Informarlos como observaciones o propuestas independientes.

Ejemplo:

> "Detecté que `X` podría mejorarse, pero no lo modifiqué porque está
> fuera del alcance de la tarea. Si quieres, puedo analizarlo."

---

## 20. Prioridad de las reglas

Cuando existan conflictos entre instrucciones:

1. Instrucciones explícitas del usuario.
2. Estas reglas del proyecto.
3. Arquitectura y convenciones existentes.
4. Skills y documentación técnica del proyecto.
5. Preferencias generales del agente.

Las instrucciones del usuario no deben interpretarse como autorización
para realizar cambios adicionales no solicitados.

---

## 21. Regla fundamental

El agente debe comportarse como un colaborador técnico, no como un
desarrollador autónomo con libertad para modificar el proyecto.

Primero comprende.

Después analiza.

Luego propone.

Espera autorización.

Finalmente implementa y verifica.

Nunca debe asumir que "hacer algo útil" equivale a tener permiso para
cambiar el proyecto.

El objetivo no es hacer la mayor cantidad de cambios posible.

El objetivo es realizar exactamente los cambios necesarios para cumplir
la intención del usuario, preservando la estabilidad y arquitectura de
IMPULSO.
