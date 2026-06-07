# 🏫 CBTIS 61 - Sistema de Gestión Académica y Seguimiento de Alumnos

Sistema completo de gestión académica desarrollado para el Centro de Bachillerato Tecnológico Industrial y de Servicios No. 61 (CBTIS 61).

## 📋 Características Principales

### Backend (NestJS + TypeScript)
- ✅ **Autenticación JWT** con roles (Admin, Docente, Alumno, Padre)
- ✅ **QR Smart-Check** - Validación en tiempo real de asistencia por QR
- ✅ **Motor de Alertas** - Regla de las 3 faltas (Semáforo Rojo)
- ✅ **Conflict Check de Horarios** - Prevención de colisiones docente/aula/grupo
- ✅ **Logs de Auditoría** - Registro completo de cambios en calificaciones
- ✅ **API RESTful** documentada con Swagger

### Frontend (React + Vite + Tailwind CSS)
- ✅ **Diseño Mobile-First** responsivo
- ✅ **Credencial Digital con QR dinámico** (regeneración automática cada 30s)
- ✅ **Dashboard por rol** - Interfaces adaptadas a cada tipo de usuario
- ✅ **Pase de lista por QR** - Escaneo rápido para docentes
- ✅ **Gestión de calificaciones** con auditoría integrada

## 🚀 Instalación y Configuración

### Requisitos
- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### 1. Base de Datos
```bash
# Crear base de datos en PostgreSQL
createdb cbtis61
```

### 2. Backend
```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Cargar datos de prueba
npx prisma db seed

# Iniciar servidor
npm run start:dev
```

El backend estará disponible en: `http://localhost:3000/api`
Documentación Swagger: `http://localhost:3000/api/docs`

### 3. Frontend
```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

## 🔐 Credenciales de Prueba

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador (Subdirector) | subdirector@cbtis61.edu.mx | admin123 |
| Docente | juan.perez@cbtis61.edu.mx | teacher123 |
| Alumno | alumno1@cbtis61.edu.mx | student123 |
| Padre de Familia | padre1@email.com | parent123 |

## 📁 Estructura del Proyecto

```
cbtis61-sistema/
├── backend/
│   ├── src/
│   │   ├── auth/           # Autenticación JWT
│   │   ├── users/          # Gestión de usuarios
│   │   ├── attendance/     # Asistencias y QR Smart-Check
│   │   ├── schedules/      # Horarios con Conflict Check
│   │   ├── grades/         # Calificaciones con Auditoría
│   │   ├── notifications/  # Sistema de notificaciones
│   │   ├── common/         # Guards, Decorators, Enums
│   │   ├── prisma.service.ts
│   │   ├── prisma.module.ts
│   │   ├── qr.service.ts
│   │   ├── qr.controller.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma   # Modelo de datos completo
│   │   └── seed.ts         # Datos de prueba
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── common/     # Button, Card, Badge, Input, Modal, Toast
    │   │   └── layout/     # Sidebar, Header, Layout, ProtectedRoute
    │   ├── pages/
    │   │   ├── auth/       # Login
    │   │   ├── admin/      # Red Semaphore, Schedules
    │   │   ├── teacher/    # QR Scanner
    │   │   ├── student/    # My QR, Schedule
    │   │   ├── parent/     # Parent Dashboard
    │   │   └── Dashboard, Grades, Notifications
    │   ├── context/        # AuthContext
    │   ├── hooks/          # useAuth, useApi
    │   ├── services/       # API service (Axios)
    │   ├── types/          # TypeScript interfaces
    │   ├── utils/          # Helpers y formatters
    │   ├── App.tsx
    │   └── main.tsx
    └── package.json
```

## 🛡️ Seguridad

- Autenticación JWT con tokens de acceso
- RolesGuard para restricción de endpoints por rol
- Validación de datos con class-validator
- Hash de contraseñas con bcrypt (12 rounds)
- Helmet para headers de seguridad HTTP
- CORS configurado

## 📱 Funcionalidades por Rol

### Subdirector (Admin)
- Dashboard con métricas generales
- Lista de alumnos en Semáforo Rojo
- Gestión completa de horarios (con detección de conflictos)
- Envío manual de notificaciones a padres
- Auditoría de calificaciones

### Docente
- Pase de lista por escaneo QR
- Registro manual de faltas
- Gestión de calificaciones por parcial
- Consulta de horario personal

### Alumno
- Credencial digital con QR dinámico (auto-regeneración)
- Visualización de horario semanal
- Semáforo visual de rendimiento
- Historial de calificaciones

### Padre de Familia
- Seguimiento de desempeño de tutorados
- Buzón de alertas de inasistencias
- Notificaciones por email/SMS

## 🔧 Tecnologías Utilizadas

**Backend:**
- NestJS 10
- Prisma ORM
- PostgreSQL
- Passport JWT
- class-validator / class-transformer

**Frontend:**
- React 19
- Vite 6
- TypeScript 5
- Tailwind CSS 4
- React Router DOM 7
- Axios
- Recharts
- Lucide React

## 📄 Licencia

Proyecto desarrollado exclusivamente para el CBTIS 61.

---
**Desarrollado con ❤️ para la educación técnica de México**
