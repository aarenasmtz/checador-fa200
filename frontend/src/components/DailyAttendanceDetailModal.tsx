import React, { useState } from 'react';
import {
  X,
  Clock,
  UtensilsCrossed,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Edit3,
  Calendar,
  Building2,
  User
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface DailyAttendanceDetailModalProps {
  record: any | null;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenAudit?: (record: any) => void;
}

export const DailyAttendanceDetailModal: React.FC<DailyAttendanceDetailModalProps> = ({
  record,
  onClose,
  onRefresh,
  onOpenAudit,
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isZh = language === 'zh-CN';

  const [showTechnical, setShowTechnical] = useState(false);

  if (!record) return null;

  // Format minutes into legible string: "8 h 22 min" or "35 min"
  const formatMinutesLegible = (totalMins: number | null | undefined): string => {
    if (totalMins === null || totalMins === undefined || isNaN(totalMins) || totalMins === 0) {
      return isZh ? '0 分钟' : '0 min';
    }
    const hours = Math.floor(totalMins / 60);
    const mins = Math.round(totalMins % 60);
    if (hours === 0) {
      return `${mins} min`;
    }
    if (mins === 0) {
      return isZh ? `${hours} 小时` : `${hours} h`;
    }
    return isZh ? `${hours}小时 ${mins}分` : `${hours} h ${mins} min`;
  };

  // Format punch time or display "—"
  const formatPunchTime = (val?: string | null): string => {
    if (!val || val === '--:--' || val === '-') return '—';
    // Clean potential full ISO string (e.g. 2026-11-01T08:05:00)
    if (val.includes('T')) {
      const timePart = val.split('T')[1];
      return timePart ? timePart.substring(0, 5) : '—';
    }
    return val.substring(0, 5);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('ontime') || s.includes('completo')) {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        text: isZh ? '准时出勤' : 'A tiempo',
      };
    }
    if (s.includes('late') || s.includes('retardo')) {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        text: isZh ? '迟到' : 'Retardo',
      };
    }
    if (s.includes('incomplete') || s.includes('incompleto')) {
      return {
        bg: 'bg-orange-50 text-orange-800 border-orange-200',
        icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
        text: isZh ? '打卡不全' : 'Incompleto',
      };
    }
    if (s.includes('absent') || s.includes('falta')) {
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        icon: <XCircle className="w-4 h-4 text-rose-600" />,
        text: isZh ? '缺勤 / 旷工' : 'Falta',
      };
    }
    if (s.includes('rest') || s.includes('descanso')) {
      return {
        bg: 'bg-blue-50 text-blue-800 border-blue-200',
        icon: <Coffee className="w-4 h-4 text-blue-600" />,
        text: isZh ? '公休' : 'Descanso',
      };
    }
    return {
      bg: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: <Clock className="w-4 h-4 text-slate-500" />,
      text: record.status || (isZh ? '待核实' : 'Pendiente'),
    };
  };

  const statusBadge = getStatusBadge(record.status);
  const cleanDate = record.date ? record.date.split('T')[0] : '—';
  const canJustify = user?.roles?.some(r => r === 'SUPERADMIN' || r === 'ADMIN_SUCURSAL' || r === 'RH');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#DFE7EB] rounded-2xl shadow-xl w-full max-w-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#DFE7EB] flex items-start justify-between bg-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F2F0] text-[#00695F] flex items-center justify-center font-bold text-base shrink-0 border border-[#B2DFDB]">
              {record.employeeCode || '#'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#203441] leading-tight">
                  {record.employeeName || 'Empleado'}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  #{record.employeeCode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#60727E] mt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{record.branchName || 'Oficina Central'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cleanDate}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Summary KPIs Row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-[#F4F7F8] border border-[#DFE7EB] rounded-xl">
              <span className="text-[11px] text-[#60727E] font-medium block">
                {isZh ? '实际工时' : 'Horas trabajadas'}
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#203441] block mt-0.5">
                {formatMinutesLegible(record.minutesWorked)}
              </span>
            </div>

            <div className="p-3 bg-[#F4F7F8] border border-[#DFE7EB] rounded-xl">
              <span className="text-[11px] text-[#60727E] font-medium block">
                {isZh ? '迟到时长' : 'Retardo'}
              </span>
              <span className={`text-base sm:text-lg font-bold font-mono block mt-0.5 ${
                record.minutesLate > 0 ? 'text-amber-700' : 'text-[#00695F]'
              }`}>
                {record.minutesLate > 0 ? `${record.minutesLate} min` : (isZh ? '0 分' : '0 min')}
              </span>
            </div>

            <div className="p-3 bg-[#F4F7F8] border border-[#DFE7EB] rounded-xl flex flex-col justify-between">
              <span className="text-[11px] text-[#60727E] font-medium block">
                {isZh ? '判定状态' : 'Estado'}
              </span>
              <div className="mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.bg}`}>
                  {statusBadge.icon}
                  <span>{statusBadge.text}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 4 Punch Cards ("Tarjetas claras") */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#60727E] mb-2">
              {isZh ? '四次打卡时标' : 'Marcaciones de la Jornada (4 Checadas)'}
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Entrada */}
              <div className="p-3.5 rounded-xl border border-[#DFE7EB] bg-white hover:border-[#00695F]/40 transition shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#60727E] mb-1">
                  <span className="font-semibold text-emerald-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{isZh ? '1. 上班进' : '1. Entrada'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {record.expectedEntry ? `${record.expectedEntry.substring(0, 5)} esp` : ''}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#203441] mt-1 tracking-tight">
                  {formatPunchTime(record.firstEntry)}
                </div>
              </div>

              {/* 2. Salida a comida */}
              <div className="p-3.5 rounded-xl border border-[#DFE7EB] bg-white hover:border-[#00695F]/40 transition shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#60727E] mb-1">
                  <span className="font-semibold text-amber-800 flex items-center gap-1">
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>{isZh ? '2. 就餐出' : '2. Salida Comida'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {record.expectedMealStart ? `${record.expectedMealStart.substring(0, 5)} esp` : ''}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#203441] mt-1 tracking-tight">
                  {formatPunchTime(record.mealExit)}
                </div>
              </div>

              {/* 3. Regreso de comida */}
              <div className="p-3.5 rounded-xl border border-[#DFE7EB] bg-white hover:border-[#00695F]/40 transition shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#60727E] mb-1">
                  <span className="font-semibold text-teal-800 flex items-center gap-1">
                    <Coffee className="w-3.5 h-3.5" />
                    <span>{isZh ? '3. 就餐归' : '3. Regreso Comida'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {record.expectedMealEnd ? `${record.expectedMealEnd.substring(0, 5)} esp` : ''}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#203441] mt-1 tracking-tight">
                  {formatPunchTime(record.mealReturn)}
                </div>
              </div>

              {/* 4. Salida de turno */}
              <div className="p-3.5 rounded-xl border border-[#DFE7EB] bg-white hover:border-[#00695F]/40 transition shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#60727E] mb-1">
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{isZh ? '4. 下班退' : '4. Salida Turno'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {record.expectedExit ? `${record.expectedExit.substring(0, 5)} esp` : ''}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-[#203441] mt-1 tracking-tight">
                  {formatPunchTime(record.lastExit)}
                </div>
              </div>
            </div>
          </div>

          {/* Audit Override Indicator if manually edited */}
          {record.isManualOverride && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {isZh ? '该记录包含人工审核修正' : 'Registro modificado administrativamente'}
                </span>
                <span className="text-amber-800 block mt-0.5">
                  {isZh ? '修改人:' : 'Por:'} <strong>{record.modifiedBy || 'Admin'}</strong>
                  {record.modifiedAt ? ` (${record.modifiedAt})` : ''}
                </span>
                {record.modificationReason && (
                  <p className="text-amber-800 italic mt-0.5">
                    "{record.modificationReason}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Technical & Origin Section */}
          <div className="border border-[#DFE7EB] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnical(!showTechnical)}
              className="w-full px-4 py-2.5 bg-[#F4F7F8] hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-[#203441] transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#00695F]" />
                <span>{isZh ? '技术参数与设备来源' : 'Datos técnicos y trazabilidad'}</span>
              </span>
              {showTechnical ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showTechnical && (
              <div className="p-4 bg-white text-xs space-y-2 border-t border-[#DFE7EB] font-mono">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#60727E] font-sans">{isZh ? '数据来源 / 模式:' : 'Origen / Modo:'}</span>
                  <span className="font-semibold text-[#203441]">{record.origin || 'FA200-BIOMETRIC'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#60727E] font-sans">{isZh ? '物理打卡设备:' : 'Dispositivo físico:'}</span>
                  <span className="font-semibold text-[#00695F]">FA200 (ZKTeco)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#60727E] font-sans">{isZh ? '生物识别介质:' : 'Medio de verificación:'}</span>
                  <span className="text-[#203441]">Rostro / Huella Dactilar</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#60727E] font-sans">{isZh ? '排班就餐扣除:' : 'Deducción de comida:'}</span>
                  <span className="text-[#203441]">
                    {record.mealDurationMinutes ? `${record.mealDurationMinutes} min netos` : '60 min estándar'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#F4F7F8] border-t border-[#DFE7EB] flex items-center justify-between gap-3">
          {canJustify && onOpenAudit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAudit(record);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-[#00695F] border border-[#B2DFDB] hover:bg-[#E6F2F0] transition shadow-2xs cursor-pointer min-h-[40px]"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isZh ? '人工修正 / 审核' : 'Justificar / Modificar'}</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00695F] hover:bg-[#00524A] text-white transition shadow-xs cursor-pointer min-h-[40px]"
          >
            {isZh ? '关闭' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
