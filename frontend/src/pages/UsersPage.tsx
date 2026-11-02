import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  LayoutGrid,
  Table as TableIcon,
  Search,
  User,
  Shield,
  Building2,
  Mail,
  Calendar
} from 'lucide-react';
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

  // Mosaico / Lista mode with localStorage persistence
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('users_view_mode') as 'grid' | 'table') || 'table';
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('users_view_mode', mode);
  };

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

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      u.fullName.toLowerCase().includes(term) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.branchName && u.branchName.toLowerCase().includes(term)) ||
      u.roles.some((r) => r.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#203441] tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#00695F]" />
            {t('users.title')}
          </h1>
          <p className="text-xs text-[#60727E] mt-1">
            {language === 'zh-CN'
              ? '管理系统操作员账号、总部与各分店管理员角色及权限分配'
              : 'Administración de usuarios, roles de oficina central y permisos de sucursal'}
          </p>
        </div>

        {/* View Mode Toggle: Grid vs Table */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#DFE7EB] shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={language === 'zh-CN' ? '网格卡片视图' : 'Vista en cuadrícula de tarjetas (Mosaico)'}
              aria-label="Mosaico"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={language === 'zh-CN' ? '表格视图' : 'Vista en tabla compacta (Lista)'}
              aria-label="Lista"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#60727E]" />
          <input
            type="text"
            placeholder={language === 'zh-CN' ? '搜索用户名、姓名、邮箱或角色...' : 'Buscar usuario, nombre, rol o sucursal...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#DFE7EB] rounded-xl text-xs text-[#203441] placeholder-[#60727E] focus:bg-white focus:border-[#00695F] focus:outline-none min-h-[42px]"
          />
        </div>
      </div>

      {/* Main Content: Loading / Empty / Grid / Table */}
      {loading ? (
        <div className="bg-white border border-[#DFE7EB] rounded-2xl p-12 text-center text-[#60727E] text-xs">
          {t('common.loading')}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DFE7EB] rounded-2xl p-12 text-center space-y-2">
          <User className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-[#203441]">No se encontraron usuarios</h3>
          <p className="text-xs text-[#60727E]">Intenta con otro término de búsqueda.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ==================== 1. GRID (MOSAICO) ==================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const initials = u.fullName
              ? u.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
              : u.username.slice(0, 2).toUpperCase();

            return (
              <div
                key={u.id}
                className="bg-white border border-[#DFE7EB] rounded-2xl p-5 hover:border-[#00695F]/40 hover:shadow-md transition shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#E6F2F0] border border-[#00695F]/20 flex items-center justify-center text-[#00695F] font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#203441] text-sm truncate">{u.fullName}</h4>
                        <span className="font-mono text-xs text-[#00695F] font-semibold">@{u.username}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      Activo
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#DFE7EB]/60 space-y-2 text-xs text-[#60727E]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium text-[#203441]">
                        {u.branchName || (language === 'zh-CN' ? '总部 (全部权限)' : 'Oficina Central (Global)')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px]">
                        Alta: {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#DFE7EB]/60">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/20 font-mono"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== 2. TABLE / LIST (LISTA) ==================== */
        <div className="space-y-3">
          {/* Mobile vertical cards */}
          <div className="block sm:hidden space-y-3">
            {filteredUsers.map((u) => (
              <div key={u.id} className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-[#203441] text-sm">{u.fullName}</h4>
                    <span className="font-mono text-xs text-[#00695F]">@{u.username}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Activo
                  </span>
                </div>
                <p className="text-xs text-[#60727E]">📧 {u.email}</p>
                <p className="text-xs text-[#203441] font-medium">
                  🏢 {u.branchName || 'Oficina Central (Global)'}
                </p>
                <div className="pt-2 border-t border-[#DFE7EB]/60 flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <span key={r} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6F2F0] text-[#00695F]">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white border border-[#DFE7EB] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-[#60727E] font-semibold border-b border-[#DFE7EB]">
                  <tr>
                    <th className="px-4 py-3">{t('auth.username')}</th>
                    <th className="px-4 py-3">{t('common.name')}</th>
                    <th className="px-4 py-3">{t('common.branch')}</th>
                    <th className="px-4 py-3">{t('users.role')}</th>
                    <th className="px-4 py-3 text-center">{t('common.status')}</th>
                    <th className="px-4 py-3 text-right">{language === 'zh-CN' ? '注册时间' : 'Fecha Registro'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE7EB]/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5 font-mono text-xs">
                        <div className="font-bold text-[#00695F]">@{u.username}</div>
                        <div className="text-[11px] text-[#60727E]">{u.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[#203441] font-semibold">{u.fullName}</td>
                      <td className="px-4 py-3.5 text-xs text-[#60727E]">
                        {u.branchName || (language === 'zh-CN' ? '总部 (全部权限)' : 'Oficina Central (Global)')}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/20 font-mono"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {t('users.active')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#60727E] font-mono text-right">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
