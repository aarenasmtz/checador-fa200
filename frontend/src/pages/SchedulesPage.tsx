import React, { useState, useEffect } from 'react';
import { CalendarClock, Clock, UtensilsCrossed } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface Schedule {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  lunchBreakMinutes: number;
  workDays: string;
  isActive: boolean;
}

export const SchedulesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/schedules');
      setSchedules(res.data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const daysMap: Record<string, string> = {
    '1': language === 'zh-CN' ? '周一' : 'Lun',
    '2': language === 'zh-CN' ? '周二' : 'Mar',
    '3': language === 'zh-CN' ? '周三' : 'Mié',
    '4': language === 'zh-CN' ? '周四' : 'Jue',
    '5': language === 'zh-CN' ? '周五' : 'Vie',
    '6': language === 'zh-CN' ? '周六' : 'Sáb',
    '0': language === 'zh-CN' ? '周日' : 'Dom',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-indigo-600" />
          {t('schedules.title')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'zh-CN'
            ? '配置上班与下班时间基准、迟到容差阈值（默认10分钟）及就餐扣减规则'
            : 'Configuración de turnos, tolerancia de retardo (10 min por defecto) y tiempos de comida'}
        </p>
      </div>

      {/* Grid of Schedules */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse text-xs">
          {t('common.loading')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                  <span className="text-xs text-indigo-600 font-mono font-semibold">{s.code}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {language === 'zh-CN' ? '生效中' : 'Activo'}
                </span>
              </div>

              {/* Time Block */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="text-center flex-1">
                  <span className="text-[11px] text-slate-500 uppercase block font-semibold">{t('common.entry')}</span>
                  <span className="text-lg font-bold text-indigo-600 font-mono">{s.startTime.substring(0, 5)}</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-200" />
                <div className="text-center flex-1">
                  <span className="text-[11px] text-slate-500 uppercase block font-semibold">{t('common.exit')}</span>
                  <span className="text-lg font-bold text-slate-800 font-mono">{s.endTime.substring(0, 5)}</span>
                </div>
              </div>

              {/* Rules */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    {t('schedules.tolerance')}
                  </span>
                  <span className="font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">{s.toleranceMinutes} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-500" />
                    {t('schedules.lunch')}
                  </span>
                  <span className="font-semibold text-slate-800 font-mono">{s.lunchBreakMinutes} min</span>
                </div>
              </div>

              {/* Work days badge list */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-2 font-medium">{t('schedules.workDays')}:</span>
                <div className="flex flex-wrap gap-1">
                  {['1', '2', '3', '4', '5', '6', '0'].map((day) => {
                    const isWorkDay = s.workDays.includes(day);
                    return (
                      <span
                        key={day}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isWorkDay
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {daysMap[day]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
