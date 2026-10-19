import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface UserItem {
  id: number;
  username: string;
  email: string;
  fullName: string;
  branchName?: string;
  status: string;
  roles: string[];
  createdAt: string;
}

export const UsersPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/users');
      setUsers(res.data.items || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          {t('users.title')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'zh-CN'
            ? '管理系统操作员账号、总部与各分店管理员角色及权限分配'
            : 'Administración de usuarios, roles de oficina central y permisos de sucursal'}
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-xs uppercase text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t('auth.username')}</th>
                <th className="px-4 py-3">{t('common.name')}</th>
                <th className="px-4 py-3">{t('common.branch')}</th>
                <th className="px-4 py-3">{t('users.role')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
                <th className="px-4 py-3">{language === 'zh-CN' ? '注册时间' : 'Fecha Registro'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-mono text-xs">
                      <div className="font-bold text-indigo-600">{u.username}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-900 font-semibold">{u.fullName}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {u.branchName || (language === 'zh-CN' ? '总部 (全部权限)' : 'Oficina Central (Global)')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {t('users.active')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
