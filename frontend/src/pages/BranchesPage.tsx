import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  MapPin,
  Cpu,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Search
} from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface Branch {
  id: number;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  timeZone: string;
  status: string;
  isActive?: boolean;
  devicesCount?: number;
  deviceCount?: number;
  employeesCount?: number;
  employeeCount?: number;
}

export const BranchesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View Mode with localStorage persistence ('grid' or 'table')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('branches_view_mode') as 'grid' | 'table') || 'grid';
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('branches_view_mode', mode);
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    timeZone: 'America/Mexico_City',
    status: 'Active'
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/branches');
      setBranches(res.data || []);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleOpenAddModal = () => {
    setEditingBranch(null);
    setFormData({
      code: '',
      name: '',
      address: '',
      timeZone: 'America/Mexico_City',
      status: 'Active'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: Branch) => {
    setEditingBranch(b);
    setFormData({
      code: b.code,
      name: b.name,
      address: b.address || '',
      timeZone: b.timeZone || 'America/Mexico_City',
      status: b.status === 'Active' || b.isActive ? 'Active' : 'Inactive'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(language === 'zh-CN' ? '请输入分店名称' : 'El nombre de la sucursal es obligatorio.');
      return;
    }
    if (!editingBranch && !formData.code.trim()) {
      setFormError(language === 'zh-CN' ? '请输入分店编号' : 'El código de la sucursal es obligatorio.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingBranch) {
        await api.put(`/v1/branches/${editingBranch.id}`, {
          name: formData.name.trim(),
          address: formData.address.trim(),
          timeZone: formData.timeZone,
          status: formData.status
        });
        showNotification(language === 'zh-CN' ? '分店信息更新成功' : 'Sucursal actualizada exitosamente.');
      } else {
        await api.post('/v1/branches', {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          address: formData.address.trim(),
          timeZone: formData.timeZone
        });
        showNotification(language === 'zh-CN' ? '新分店创建成功' : 'Nueva sucursal registrada exitosamente.');
      }
      setIsModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar la sucursal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    setDeleting(true);
    try {
      await api.delete(`/v1/branches/${deletingBranch.id}`);
      showNotification(language === 'zh-CN' ? '分店已成功删除' : 'Sucursal eliminada exitosamente.');
      setDeletingBranch(null);
      fetchBranches();
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Error al eliminar sucursal.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredBranches = branches.filter((b) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.name.toLowerCase().includes(term) ||
      b.code.toLowerCase().includes(term) ||
      (b.address && b.address.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#203441] tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#00695F]" />
            {t('branches.title')}
          </h1>
          <p className="text-xs text-[#60727E] mt-1">
            {language === 'zh-CN'
              ? '管理华龙商业集团旗下所有商场及仓储分店架构 (增删改查)'
              : 'ABC de Sucursales: Alta, Baja y Cambio de tiendas y centros del Grupo Hualong'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Mosaico / Lista Selector */}
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
              title={language === 'zh-CN' ? '列表表格视图' : 'Vista en tabla compacta (Lista)'}
              aria-label="Lista"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchBranches}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#DFE7EB] text-xs font-semibold text-[#203441] hover:bg-slate-50 shadow-2xs transition min-h-[40px]"
          >
            <RefreshCw className="w-4 h-4 text-[#00695F]" />
            <span>{language === 'zh-CN' ? '刷新' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '新增分店' : 'Nueva Sucursal'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#60727E]" />
          <input
            type="text"
            placeholder={language === 'zh-CN' ? '搜索分店名称、编号或地址...' : 'Buscar sucursal por nombre, código o dirección...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#DFE7EB] rounded-xl text-xs text-[#203441] placeholder-[#60727E] focus:bg-white focus:border-[#00695F] focus:outline-none min-h-[42px]"
          />
        </div>
      </div>

      {/* Notification Toast */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 shadow-2xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Content: Loading / Empty / Grid / Table */}
      {loading ? (
        <div className="text-center py-12 text-[#60727E] animate-pulse text-xs">
          {t('common.loading')}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DFE7EB] rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F2F0] border border-[#00695F]/20 flex items-center justify-center text-[#00695F] mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#203441]">
              {language === 'zh-CN' ? '未找到符合条件的分店' : 'No se encontraron sucursales'}
            </h3>
            <p className="text-xs text-[#60727E] mt-1 max-w-md mx-auto">
              {language === 'zh-CN'
                ? '请尝试修改搜索词或点击“新增分店”创建新网点。'
                : 'Intente con otro término de búsqueda o dé de alta una nueva sucursal.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '立即添加分店' : 'Agregar Sucursal Ahora'}</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ==================== 1. GRID (MOSAICO) ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredBranches.map((b) => {
            const isOnline = b.status === 'Active' || b.isActive !== false;
            return (
              <div
                key={b.id}
                className="bg-white border border-[#DFE7EB] rounded-2xl p-5 hover:border-[#00695F]/40 hover:shadow-md transition shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E6F2F0] border border-[#00695F]/20 flex items-center justify-center text-[#00695F] font-bold text-sm">
                      {b.code}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#203441] text-base">{b.name}</h3>
                      <span className="text-xs text-[#60727E] font-mono">{b.timeZone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isOnline
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isOnline ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{language === 'zh-CN' ? '正常运营' : 'Activa'}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{language === 'zh-CN' ? '已停用' : 'Inactiva'}</span>
                        </>
                      )}
                    </span>

                    <button
                      onClick={() => handleOpenEditModal(b)}
                      title="Editar sucursal"
                      className="p-1.5 rounded-lg text-[#60727E] hover:text-[#00695F] hover:bg-[#E6F2F0] transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeletingBranch(b)}
                      title="Eliminar sucursal"
                      className="p-1.5 rounded-lg text-[#60727E] hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#60727E]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{b.address || (language === 'zh-CN' ? '未登记地址' : 'Sin dirección especificada')}</span>
                  </div>
                  {b.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#DFE7EB]/60 flex items-center justify-between text-xs text-[#60727E]">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#00695F]" />
                    <span>FA200 设备: <strong className="text-[#203441] font-semibold">{b.deviceCount ?? b.devicesCount ?? 0} 台</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>员工编制: <strong className="text-[#203441] font-semibold">{b.employeeCount ?? b.employeesCount ?? 0} 人</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== 2. TABLE / LIST (LISTA) ==================== */
        <div className="space-y-3">
          {/* Mobile Vertical Cards (iPhone friendly, no horizontal overflow) */}
          <div className="block sm:hidden space-y-3">
            {filteredBranches.map((b) => {
              const isOnline = b.status === 'Active' || b.isActive !== false;
              return (
                <div key={b.id} className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-[#00695F] bg-[#E6F2F0] px-2 py-0.5 rounded border border-[#00695F]/20">
                        {b.code}
                      </span>
                      <h4 className="font-bold text-[#203441] text-sm mt-1">{b.name}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isOnline ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="text-xs text-[#60727E] space-y-1">
                    <p className="truncate">📍 {b.address || 'Sin dirección'}</p>
                    <p className="font-mono text-[11px]">🕒 {b.timeZone}</p>
                  </div>

                  <div className="pt-2 border-t border-[#DFE7EB]/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-[#60727E]">
                      <span>📠 <strong>{b.deviceCount ?? b.devicesCount ?? 0}</strong> relojes</span>
                      <span>👥 <strong>{b.employeeCount ?? b.employeesCount ?? 0}</strong> emp.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(b)}
                        className="p-2 rounded-lg text-[#00695F] bg-[#E6F2F0]"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingBranch(b)}
                        className="p-2 rounded-lg text-rose-600 bg-rose-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white border border-[#DFE7EB] rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-[#60727E] border-b border-[#DFE7EB] font-semibold">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nombre de Sucursal</th>
                  <th className="py-3 px-4">Dirección</th>
                  <th className="py-3 px-4">Zona Horaria</th>
                  <th className="py-3 px-4 text-center">Dispositivos</th>
                  <th className="py-3 px-4 text-center">Empleados</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE7EB]/60">
                {filteredBranches.map((b) => {
                  const isOnline = b.status === 'Active' || b.isActive !== false;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#00695F]">{b.code}</td>
                      <td className="py-3 px-4 font-semibold text-[#203441]">{b.name}</td>
                      <td className="py-3 px-4 text-[#60727E] max-w-[200px] truncate">{b.address || '-'}</td>
                      <td className="py-3 px-4 font-mono text-[#60727E]">{b.timeZone}</td>
                      <td className="py-3 px-4 text-center font-bold text-[#203441]">
                        {b.deviceCount ?? b.devicesCount ?? 0}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#203441]">
                        {b.employeeCount ?? b.employeesCount ?? 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isOnline ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1.5 rounded-lg text-[#60727E] hover:text-[#00695F] hover:bg-[#E6F2F0] transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingBranch(b)}
                            className="p-1.5 rounded-lg text-[#60727E] hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>
                  {editingBranch
                    ? (language === 'zh-CN' ? '编辑分店信息 (Cambios)' : 'Editar Sucursal')
                    : (language === 'zh-CN' ? '新增分店登记 (Altas)' : 'Nueva Sucursal')}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBranch} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '分店编号 (Code) *' : 'Código de Sucursal *'}
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled={!!editingBranch}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="CENTRO"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono uppercase focus:bg-white focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '时区 (TimeZone)' : 'Zona Horaria'}
                  </label>
                  <select
                    value={formData.timeZone}
                    onChange={(e) => setFormData({ ...formData, timeZone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="America/Mexico_City">America/Mexico_City (CDMX)</option>
                    <option value="America/Monterrey">America/Monterrey</option>
                    <option value="America/Cancun">America/Cancun</option>
                    <option value="America/Tijuana">America/Tijuana</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {language === 'zh-CN' ? '分店全名 *' : 'Nombre de la Sucursal *'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="中心店 (Sucursal Centro)"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {language === 'zh-CN' ? '详细地址' : 'Dirección'}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Av. Reforma 120, CDMX"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {editingBranch && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '运营状态' : 'Estado'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Active">Activa / Operativa</option>
                    <option value="Inactive">Inactiva</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {language === 'zh-CN' ? '确认删除此分店？' : '¿Eliminar Sucursal?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingBranch.name} ({deletingBranch.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {language === 'zh-CN'
                ? '注意：如果该分店下仍有关联的在职员工或考勤机，请先将其解绑或转移。'
                : 'Aviso: No se puede eliminar una sucursal si aún tiene empleados o checadores asignados.'}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBranch(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteBranch}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
