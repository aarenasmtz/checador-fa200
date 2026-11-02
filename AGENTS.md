# AGENTS.md / CODEX.md

Este repositorio cuenta con un archivo maestro de contexto estructurado especialmente para asistentes de inteligencia artificial, modelos de lenguaje y entornos de desarrollo autónomos (Codex, Copilot, Cursor, Claude Code, Gemini CLI, etc.).

👉 **Por favor consulta y carga en tu contexto el archivo principal:**  
[AI_CONTEXT.md](file:///d:/Proyecto%20-%20Checador/AI_CONTEXT.md)

---

### Resumen Rápido para Agentes:
* **Proyecto:** Control de Asistencia y Checador Biométrico FA200 (Grupo Hualong / Cadena de Restaurantes 百分百 - David Guan).
* **Rama Activa:** `feature/prueba-fa200-mango-wireguard`
* **Arquitectura de Red:** Checador FA200 (`10.10.1.10:4370`) conectado a router GL.iNet Mango (`10.10.1.1`), el cual mantiene un túnel WireGuard (`10.10.0.2`) hacia el VPS Hostinger (`193.46.198.88:51820`). El servicio `checador-sync.service` sondea el reloj directamente e ingiere a la API en `127.0.0.1:5081`.
* **Stack:** .NET 9 Web API (Clean Architecture) + SQL Server (`ChecadorDb`) + React 19 / Vite / Tailwind v4 (bilingüe Español / Chino).
* **Restricción Crítica:** NO TOCAR ni reiniciar **Lambrín POS** (`pos-api.service`, puerto 5000, `api.wpcbajio.com`), el cual coexiste en el mismo VPS.
