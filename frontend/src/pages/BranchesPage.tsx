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
import { ErrorState, LoadingState } from '../components/AsyncState';
import { useCatalogView } from '../hooks/useCatalogView';
import { CatalogCollection } from '../components/CatalogCollection';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View Mode with localStorage persistence ('grid' or 'table')
  const { viewMode, handleSetViewMode } = useCatalogView('branches');
  const [searchTerm, setSearchTerm] = useState('');


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
      setLoadError(null);
      const res = await api.get('/v1/branches');
      setBranches(res.data || []);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
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
      setFormError(t('branches.ui_el_nombre_de_la_sucursal_es'));
      return;
    }
    if (!editingBranch && !formData.code.trim()) {
      setFormError(t('branches.ui_el_codigo_de_la_sucursal_es'));
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
        showNotification(t('branches.ui_sucursal_actualizada_exitosamente'));
      } else {
        await api.post('/v1/branches', {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          address: formData.address.trim(),
          timeZone: formData.timeZone
        });
        showNotification(t('branches.ui_nueva_sucursal_registrada_exitosamente'));
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
      showNotification(t('branches.ui_sucursal_eliminada_exitosamente'));
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
            {t('branches.ui_abc_de_sucursales_alta_baja_y')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Mosaico / Lista Selector */}
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
              title={t('branches.ui_vista_en_cuadricula_de_tarjetas_mosaico')}
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
              title={t('branches.ui_vista_en_tabla_compacta_lista')}
              aria-label={t('common.listView')}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchBranches}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#DFE7EB] text-xs font-semibold text-[#203441] hover:bg-slate-50 shadow-2xs transition min-h-[40px]"
          >
            <RefreshCw className="w-4 h-4 text-[#00695F]" />
            <span>{t('branches.ui_actualizar')}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>{t('branches.ui_nueva_sucursal')}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#60727E]" />
          <input
            type="text"
            placeholder={t('branches.ui_buscar_sucursal_por_nombre_codigo_o')}
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
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={fetchBranches} />
      ) : filteredBranches.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DFE7EB] rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F2F0] border border-[#00695F]/20 flex items-center justify-center text-[#00695F] mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#203441]">
              {t('branches.ui_no_se_encontraron_sucursales')}
            </h3>
            <p className="text-xs text-[#60727E] mt-1 max-w-md mx-auto">
              {t('branches.ui_intente_con_otro_termino_de_busqueda')}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('branches.ui_agregar_sucursal_ahora')}</span>
          </button>
        </div>
      ) : (
        <CatalogCollection mode={viewMode} permission="employees.manage" onEdit={handleOpenEditModal} onDelete={setDeletingBranch}
          rows={filteredBranches.map(branch => ({ id: branch.id, name: branch.name, code: branch.code, status: branch.status || (branch.isActive === true ? 'Active' : branch.isActive === false ? 'Inactive' : undefined), source: branch,
            fields: [{ label: t('branches.employees'), value: branch.employeeCount ?? branch.employeesCount ?? 0 }, { label: t('branches.devices'), value: branch.deviceCount ?? branch.devicesCount ?? 0 }],
            secondary: [{ label: t('branches.address'), value: branch.address }, { label: t('branches.timeZone'), value: branch.timeZone }, { label: t('branches.phone'), value: branch.phone }]
          }))} />
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
                    ? (t('branches.ui_editar_sucursal'))
                    : (t('branches.ui_nueva_sucursal_2'))}
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
                    {t('branches.ui_codigo_de_sucursal')}
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
                    {t('branches.ui_zona_horaria')}
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
                  {t('branches.ui_nombre_de_la_sucursal')}
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
                  {t('branches.ui_direccion')}
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
                    {t('branches.ui_estado')}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Active">{t('common.active')}</option>
                    <option value="Inactive">{t('common.inactive')}</option>
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
                  {t('branches.ui_eliminar_sucursal')}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingBranch.name} ({deletingBranch.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {t('branches.ui_aviso_no_se_puede_eliminar_una')}
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
