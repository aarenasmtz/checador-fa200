import React, { useState, useEffect } from 'react';
import { Building2, Phone, MapPin, Cpu, Users, CheckCircle2, XCircle } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface Branch {
  id: number;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  timezone: string;
  isActive: boolean;
  devicesCount?: number;
  employeesCount?: number;
}

export const BranchesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/branches');
      setBranches(res.data);
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            {t('branches.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '管理华龙商业集团旗下所有商场及仓储分店架构'
              : 'Administración de sucursales y centros de distribución del Grupo Hualong'}
          </p>
        </div>
      </div>

      {/* Grid of Branches */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse text-xs">
          {t('common.loading')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {branches.map((b) => (
            <div
              key={b.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                    {b.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{b.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">{b.timezone}</span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    b.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {b.isActive ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'zh-CN' ? '正常运营' : 'Operativo'}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      {language === 'zh-CN' ? '已停用' : 'Inactivo'}
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{b.address || (language === 'zh-CN' ? '未登记地址' : 'Sin dirección')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{b.phone || (language === 'zh-CN' ? '未登记电话' : 'Sin teléfono')}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span>FA200 设备: <strong className="text-slate-800 font-semibold">1 台</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>员工编制: <strong className="text-slate-800 font-semibold">~15 人</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
