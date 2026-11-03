# AGENTS.md / CODEX.md

Este repositorio cuenta con archivos maestros de contexto estructurados especialmente para asistentes de inteligencia artificial, modelos de lenguaje y entornos de desarrollo autónomos (Codex, Copilot, Cursor, Claude Code, Gemini CLI, etc.).

👉 **Archivos Principales de Contexto:**  
- [CODEX.md](file:///d:/Proyecto%20-%20Checador/CODEX.md) — Guía rápida, directrices de diseño y especificación pantalla por pantalla.
- [AI_CONTEXT.md](file:///d:/Proyecto%20-%20Checador/AI_CONTEXT.md) — Documento maestro completo de arquitectura, hardware, VPN y reglas de negocio.

---

### Resumen Rápido para Agentes y Modelos de IA:
* **Proyecto:** Control de Asistencia y Checador Biométrico FA200 (Restaurantes BAI FEN BAI / 百分百 - David Guan).
* **Rama Activa:** `feature/rediseno-checador-web-movil`
* **Arquitectura de Red:** Checador FA200 (`10.10.1.10:4370`) conectado a router GL.iNet Mango (`10.10.1.1`), el cual mantiene un túnel WireGuard (`10.10.0.2`) hacia el VPS Hostinger (`193.46.198.88:51820`). El servicio `checador-sync.service` sondea el reloj directamente e ingiere a la API en `127.0.0.1:5081`.
* **Stack:** .NET 9 Web API (Clean Architecture) + SQL Server (`ChecadorDb`) + React 19 / Vite / Tailwind v4 (bilingüe Español / Chino).
* **Restricción Crítica 1 (Sistema):** NO TOCAR ni reiniciar **Lambrín POS** (`pos-api.service`, puerto 5000, `api.wpcbajio.com`), el cual coexiste en el mismo VPS.
* **Restricción Crítica 2 (Diseño):** NO MODIFICAR la subvista **Control de Asistencia > Calendario** (`AttendanceMatrixView.tsx`), ya que cuenta con aprobación formal del cliente.

