import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Coffee,
  Umbrella,
  Calendar,
  PenTool
} from 'lucide-react';

export type AttendanceStatusCode =
  | 'ATIEMPO'
  | 'RETARDO'
  | 'FALTA'
  | 'DESCANSO'
  | 'PERMISO'
  | 'PROGRAMADO'
  | string;

interface AttendanceStatusIconProps {
  status: AttendanceStatusCode;
  displayStatus?: string;
  isManualOverride?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
  showOverrideBadge?: boolean;
  className?: string;
}

export const AttendanceStatusIcon: React.FC<AttendanceStatusIconProps> = ({
  status,
  displayStatus,
  isManualOverride = false,
  size = 'md',
  showText = false,
  showOverrideBadge = true,
  className = '',
}) => {
  const { language } = useLanguage();
  const normalized = (status || '').toUpperCase().trim();

  const getStatusText = (zh: string, es: string) => {
    if (displayStatus && language === 'es-MX') return displayStatus;
    return language === 'zh-CN' ? zh : es;
  };

  // Configuration for each attendance status
  let config = {
    code: 'ATIEMPO',
    label: getStatusText('正常 (OnTime)', 'A tiempo'),
    ariaLabel: 'Estado: A tiempo (Presente)',
    icon: CheckCircle2,
    colorClasses: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    iconColor: 'text-emerald-600',
    emoji: '🟢',
  };

  switch (normalized) {
    case 'ATIEMPO':
    case 'ONTIME':
    case 'PRESENTE':
      config = {
        code: 'ATIEMPO',
        label: getStatusText('正常 (OnTime)', 'A tiempo'),
        ariaLabel: 'Estado: A tiempo',
        icon: CheckCircle2,
        colorClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/60 shadow-2xs',
        dotColor: 'bg-emerald-500',
        textColor: 'text-emerald-700',
        iconColor: 'text-emerald-600',
        emoji: '🟢',
      };
      break;

    case 'RETARDO':
    case 'LATE':
    case 'EARLYEXIT':
      config = {
        code: 'RETARDO',
        label: getStatusText('迟到 (Late)', 'Retardo'),
        ariaLabel: 'Estado: Retardo',
        icon: Clock,
        colorClasses: 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/60 shadow-2xs',
        dotColor: 'bg-amber-500',
        textColor: 'text-amber-700',
        iconColor: 'text-amber-600',
        emoji: '🟡',
      };
      break;

    case 'FALTA':
    case 'ABSENT':
    case 'INCOMPLETE':
      config = {
        code: 'FALTA',
        label: getStatusText('缺勤 (Absent)', 'Falta'),
        ariaLabel: 'Estado: Falta / Incompleto',
        icon: XCircle,
        colorClasses: 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100/60 shadow-2xs',
        dotColor: 'bg-rose-500',
        textColor: 'text-rose-700',
        iconColor: 'text-rose-600',
        emoji: '🔴',
      };
      break;

    case 'DESCANSO':
    case 'RESTDAY':
    case 'HOLIDAY':
      config = {
        code: 'DESCANSO',
        label: getStatusText('休息日 (RestDay)', 'Descanso'),
        ariaLabel: 'Estado: Descanso o Festivo',
        icon: Coffee,
        colorClasses: 'bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100/60 shadow-2xs',
        dotColor: 'bg-sky-500',
        textColor: 'text-sky-700',
        iconColor: 'text-sky-600',
        emoji: '🔵',
      };
      break;

    case 'PERMISO':
    case 'PERMISSION':
    case 'VACATION':
    case 'DISABILITY':
      config = {
        code: 'PERMISO',
        label: getStatusText('请假/年假 (Leave)', 'Permiso / Vacaciones'),
        ariaLabel: 'Estado: Permiso o Vacaciones autorizadas',
        icon: Umbrella,
        colorClasses: 'bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100/60 shadow-2xs',
        dotColor: 'bg-purple-500',
        textColor: 'text-purple-700',
        iconColor: 'text-purple-600',
        emoji: '🟣',
      };
      break;

    case 'PROGRAMADO':
    case 'SCHEDULED':
      config = {
        code: 'PROGRAMADO',
        label: getStatusText('计划中 (Scheduled)', 'Programado'),
        ariaLabel: 'Estado: Programado a futuro',
        icon: Calendar,
        colorClasses: 'bg-slate-50 text-slate-400 border-slate-200/60',
        dotColor: 'bg-slate-300',
        textColor: 'text-slate-500',
        iconColor: 'text-slate-400',
        emoji: '⚪',
      };
      break;

    default:
      config = {
        code: 'OTRO',
        label: displayStatus || status,
        ariaLabel: `Estado: ${displayStatus || status}`,
        icon: CheckCircle2,
        colorClasses: 'bg-slate-50 text-slate-700 border-slate-200',
        dotColor: 'bg-slate-400',
        textColor: 'text-slate-700',
        iconColor: 'text-slate-500',
        emoji: '⚪',
      };
      break;
  }

  const IconComponent = config.icon;

  const sizeClasses = {
    xs: {
      wrapper: 'w-6 h-6 rounded-md',
      icon: 'w-3 h-3',
      text: 'text-[10px]',
      badge: '-top-0.5 -right-0.5 w-2 h-2',
    },
    sm: {
      wrapper: 'w-7 h-7 rounded-lg',
      icon: 'w-3.5 h-3.5',
      text: 'text-xs',
      badge: '-top-0.5 -right-0.5 w-2 h-2',
    },
    md: {
      wrapper: 'w-8 h-8 rounded-lg',
      icon: 'w-4 h-4',
      text: 'text-xs',
      badge: '-top-1 -right-1 w-2.5 h-2.5',
    },
    lg: {
      wrapper: 'w-10 h-10 rounded-xl',
      icon: 'w-5 h-5',
      text: 'text-sm font-semibold',
      badge: '-top-1 -right-1 w-3 h-3',
    },
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={`${config.label}${isManualOverride ? (language === 'zh-CN' ? ' (人工行政修正)' : ' (Modificado administrativamente)') : ''}`}
      aria-label={config.ariaLabel}
    >
      <div
        className={`relative inline-flex items-center justify-center border transition-all select-none ${sizeClasses.wrapper} ${config.colorClasses}`}
      >
        <IconComponent className={`${sizeClasses.icon} ${config.iconColor} shrink-0`} />

        {isManualOverride && showOverrideBadge && (
          <span
            className={`absolute ${sizeClasses.badge} rounded-full bg-amber-500 border border-white ring-1 ring-amber-400/40`}
            title={language === 'zh-CN' ? '管理员人工修正记录' : 'Registro modificado manualmente por un administrador'}
          />
        )}
      </div>

      {showText && (
        <span className={`font-medium ${sizeClasses.text} ${config.textColor}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default AttendanceStatusIcon;
