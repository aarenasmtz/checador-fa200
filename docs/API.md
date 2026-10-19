# Especificación de la API REST (API.md)
## Sistema de Asistencia y Checador Biométrico FA200
### 华龙商业集团 (Grupo Comercial Hualong)

---

## 1. Convenciones y Autenticación

- **Base URL:** `/api/v1` (o `/api/devices` para simulador)
- **Formato:** JSON (`application/json`) con serialización `camelCase`.
- **Autenticación:** Cabecera HTTP `Authorization: Bearer <JWT_ACCESS_TOKEN>`.
- **Expiración de Tokens:** Access Token = 24 horas | Refresh Token = 7 días.

---

## 2. Catálogo de Endpoints

### 2.1 Autenticación (`/api/v1/auth`)

#### `POST /api/v1/auth/login`
- **Público:** Sí
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "Admin123!"
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "xYz...",
    "expiresAt": "2026-09-25T16:00:00Z",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@hualong.com",
      "fullName": "Administrador General",
      "roles": ["SUPERADMIN"],
      "permissions": ["employees.view", "attendance.view", "reports.export"]
    }
  }
  ```

#### `POST /api/v1/auth/refresh`
- **Público:** Sí
- **Request Body:** `{ "accessToken": "...", "refreshToken": "..." }`

---

### 2.2 Ingestión y Simulación Biométrica (`/api/devices/simulator`)

#### `POST /api/devices/simulator/events`
- **Descripción:** Endpoint canónico de ingestión de checadas. Pasa exactamente por el mismo pipeline criptográfico de SHA-256 e idempotencia que los eventos físicos reales.
- **Request Body:**
  ```json
  {
    "deviceCode": "FA200-CENTRO-01",
    "employeeCode": "EMP0001",
    "timestamp": "2026-09-24T07:58:32",
    "method": "Face",
    "eventType": "CheckIn"
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "isDuplicate": false,
    "message": "Evento biométrico ingerido y procesado exitosamente",
    "eventId": 1542,
    "eventHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```

#### `POST /api/devices/simulator/scenario`
- **Descripción:** Generador de casos de prueba masivos.
- **Request Body:**
  ```json
  {
    "deviceCode": "FA200-CENTRO-01",
    "employeeCode": "EMP0001",
    "scenario": "NormalDay",
    "date": "2026-09-24T00:00:00"
  }
  ```
  *Escenarios disponibles:* `"NormalDay"`, `"Late"`, `"EarlyExit"`, `"Incomplete"`, `"Duplicate"`, `"Week"`.

---

### 2.3 Asistencia y Jornadas (`/api/v1/attendance`)

#### `GET /api/v1/attendance`
- **Query Params:** `page`, `pageSize`, `startDate`, `endDate`, `branchId`, `employeeId`, `status`.
- **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "id": 1,
        "employeeId": 10,
        "employeeCode": "EMP0010",
        "employeeName": "Zhang Wei",
        "branchName": "Centro",
        "date": "2026-09-24",
        "firstEntry": "07:58:00",
        "lastExit": "18:04:00",
        "minutesWorked": 540,
        "minutesLate": 0,
        "overtimeMinutes": 4,
        "status": "OnTime"
      }
    ],
    "page": 1,
    "pageSize": 25,
    "totalRecords": 750,
    "totalPages": 30
  }
  ```

#### `POST /api/v1/attendance/reprocess`
- **Request Body:**
  ```json
  {
    "employeeId": 10,
    "branchId": null,
    "startDate": "2026-09-01",
    "endDate": "2026-09-24"
  }
  ```
- **Response 200 OK:** `{ "processedCount": 24, "message": "Asistencia recalculada exitosamente" }`

---

### 2.4 Reportes y Descargas (`/api/v1/reports`)

#### `GET /api/v1/reports/attendance`
- **Descripción:** Resumen consolidado y KPIs de horas trabajadas, retardos y horas extra.

#### `GET /api/v1/reports/export/excel`
- **Formato:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx real vía ClosedXML).
- **Características:** Paneles congelados, autofiltros y estilos institucionales.

#### `GET /api/v1/reports/export/pdf`
- **Formato:** `application/pdf` (.pdf real vía QuestPDF 2024 en orientación horizontal).
- **Características:** Tarjetas KPI, resumen gráfico, listado formateado y firmas de RRHH y Gerencia.

#### `GET /api/v1/reports/export/csv`
- **Formato:** `text/csv` (formato plano UTF-8).

---

### 2.5 Auditoría (`/api/v1/audit`)

#### `GET /api/v1/audit`
- **Query Params:** `page`, `pageSize`, `module`, `action`.
- **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "id": 102,
        "username": "admin",
        "timestamp": "2026-09-24 14:30:15",
        "ipAddress": "127.0.0.1",
        "module": "Incidents",
        "action": "APPROVE_INCIDENT",
        "entity": "AttendanceIncident",
        "recordId": "14",
        "oldValues": "{\"Status\":\"Pending\"}",
        "newValues": "{\"Status\":\"Approved\",\"ApprovedBy\":\"admin\"}"
      }
    ],
    "totalRecords": 102
  }
  ```

---

### 2.6 Salud del Sistema (`/health`)

#### `GET /health`
- **Response 200 OK:** `Healthy`
