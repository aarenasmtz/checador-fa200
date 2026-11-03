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
import { ErrorState, LoadingState } from '../components/AsyncState';
import { useCatalogView } from '../hooks/useCatalogView';
import { CatalogCollection } from '../components/CatalogCollection';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mosaico / Lista mode with localStorage persistence
  const { viewMode, handleSetViewMode } = useCatalogView('users', 'table');
  const [searchTerm, setSearchTerm] = useState('');


  const fetchUsers = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get('/v1/users');
      setUsers(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
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
            {t('users.ui_administracion_de_usuarios_roles_de_oficina')}
          </p>
        </div>

        {/* View Mode Toggle: Grid vs Table */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#DFE7EB] shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={t('users.ui_vista_en_cuadricula_de_tarjetas_mosaico')}
              aria-label={t('common.gridView')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={t('users.ui_vista_en_tabla_compacta_lista')}
              aria-label={t('common.listView')}
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
            placeholder={t('users.ui_buscar_usuario_nombre_rol_o_sucursal')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#DFE7EB] rounded-xl text-xs text-[#203441] placeholder-[#60727E] focus:bg-white focus:border-[#00695F] focus:outline-none min-h-[42px]"
          />
        </div>
      </div>

      {/* Main Content: Loading / Empty / Grid / Table */}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={fetchUsers} />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DFE7EB] rounded-2xl p-12 text-center space-y-2">
          <User className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-[#203441]">{t('users.emptyTitle')}</h3>
          <p className="text-xs text-[#60727E]">{t('users.emptyDescription')}</p>
        </div>
      ) : (
        <CatalogCollection mode={viewMode} rows={filteredUsers.map(user => ({ id: user.id, name: user.fullName, code: user.username, status: user.status, source: user,
          fields: [{ label: t('users.role'), value: user.roles?.join(' · ') }, { label: t('common.branch'), value: user.branchName || t('catalog.globalOffice') }],
          secondary: [{ label: t('catalog.email'), value: user.email }, { label: t('catalog.created'), value: new Date(user.createdAt).toLocaleDateString(language) }]
        }))} />
      )}
    </div>
  );
};
