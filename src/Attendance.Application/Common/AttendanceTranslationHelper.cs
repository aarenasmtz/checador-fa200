using Attendance.Domain.Enums;

namespace Attendance.Application.Common;

public static class AttendanceTranslationHelper
{
    public static string ToBilingualStatus(AttendanceStatus status) => status switch
    {
        AttendanceStatus.OnTime => "A tiempo / 准时",
        AttendanceStatus.Late => "Retardo / 迟到",
        AttendanceStatus.Absent => "Falta / 缺勤",
        AttendanceStatus.EarlyExit => "Salida anticipada / 早退",
        AttendanceStatus.Incomplete => "Incompleto / 打卡不全",
        AttendanceStatus.RestDay => "Descanso / 休息日",
        AttendanceStatus.Holiday => "Festivo / 节假日",
        AttendanceStatus.Vacation => "Vacaciones / 年假",
        AttendanceStatus.Permission => "Permiso / 请假",
        AttendanceStatus.Disability => "Incapacidad / 病假",
        _ => status.ToString()
    };

    public static string ToBilingualShiftStatus(
        AttendanceStatus status,
        bool requiresReview = false,
        bool hasPunches = true,
        bool isFuture = false,
        bool isJustifiedEarlyExit = false)
    {
        if (isFuture) return "Programado / 待出勤";
        if (isJustifiedEarlyExit) return "Salida justificada / 批准提前下班";
        if (requiresReview && status == AttendanceStatus.Incomplete) return "Checada incompleta / 打卡不全";
        if (requiresReview) return "Pendiente de revisión / 待核查";
        if (status == AttendanceStatus.Absent && !hasPunches) return "Sin checadas / 无打卡记录";
        if (status == AttendanceStatus.OnTime) return "Completo / 完整";
        if (status == AttendanceStatus.Late) return "Retardo / 迟到";
        if (status == AttendanceStatus.EarlyExit) return "Salida anticipada / 早退";
        return ToBilingualStatus(status);
    }

    public static string ToBilingualStatus(string? statusStr)
    {
        if (string.IsNullOrWhiteSpace(statusStr)) return "-";
        if (Enum.TryParse<AttendanceStatus>(statusStr, true, out var status))
            return ToBilingualStatus(status);
        return statusStr;
    }

    public static string ToBilingualIncidentType(IncidentType type) => type switch
    {
        IncidentType.PunchMiss => "Omisión de checada / 补卡",
        IncidentType.JustifiedAbsence => "Falta justificada / 事假",
        IncidentType.JustifiedLate => "Retardo justificado / 迟到报备",
        IncidentType.Permission => "Permiso / 请假",
        IncidentType.Vacation => "Vacaciones / 年假",
        IncidentType.Disability => "Incapacidad médica / 病假",
        IncidentType.HomeOffice => "Home Office / 居家办公",
        IncidentType.FieldWork => "Trabajo en campo / 外勤",
        IncidentType.ScheduleCorrection => "Corrección de horario / 班次调整",
        _ => type.ToString()
    };

    public static string ToBilingualIncidentType(string? typeStr)
    {
        if (string.IsNullOrWhiteSpace(typeStr)) return "-";
        if (Enum.TryParse<IncidentType>(typeStr, true, out var type))
            return ToBilingualIncidentType(type);
        return typeStr;
    }

    public static string ToBilingualIncidentStatus(IncidentStatus status) => status switch
    {
        IncidentStatus.Pending => "Pendiente / 待审批",
        IncidentStatus.Approved => "Aprobado / 已批准",
        IncidentStatus.Rejected => "Rechazado / 已驳回",
        IncidentStatus.Cancelled => "Cancelado / 已取消",
        _ => status.ToString()
    };

    public static string ToBilingualIncidentStatus(string? statusStr)
    {
        if (string.IsNullOrWhiteSpace(statusStr)) return "-";
        if (Enum.TryParse<IncidentStatus>(statusStr, true, out var status))
            return ToBilingualIncidentStatus(status);
        return statusStr;
    }

    public static string FormatMinutesAsHhMm(int totalMinutes)
    {
        if (totalMinutes < 0) totalMinutes = 0;
        int hours = totalMinutes / 60;
        int minutes = totalMinutes % 60;
        return $"{hours:D2}:{minutes:D2}";
    }

    public static string FormatMinutesFriendly(int totalMinutes)
    {
        if (totalMinutes < 0) totalMinutes = 0;
        int hours = totalMinutes / 60;
        int minutes = totalMinutes % 60;
        if (hours > 0 && minutes > 0)
            return $"{hours} h {minutes:D2} min";
        if (hours > 0)
            return $"{hours} h";
        return $"{minutes} min";
    }
}
