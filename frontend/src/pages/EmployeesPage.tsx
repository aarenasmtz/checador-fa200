import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { useCatalogView } from '../hooks/useCatalogView';
import { CatalogCollection } from '../components/CatalogCollection';
import {
  Users,
  Search,
  Eye,
  Edit3,
  X,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Fingerprint,
  Briefcase,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  MoreVertical,
  Power,
  ChevronDown,
  Filter
} from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const isZh = language === 'zh-CN';

  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  // View mode: 'grid' (cards) or 'table' (compact) with localStorage persistence
  const { viewMode, handleSetViewMode } = useCatalogView('employees');

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Active action menu popover
  const [activeMenuEmployeeId, setActiveMenuEmployeeId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Profile / Metrics modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Employee modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Employee modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create Form fields
  const [formCode, setFormCode] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formBranchId, setFormBranchId] = useState<number | ''>('');
  const [formDepartmentId, setFormDepartmentId] = useState<number | ''>('');
  const [formPositionId, setFormPositionId] = useState<number | ''>('');
  const [formScheduleId, setFormScheduleId] = useState<number | ''>('');
  const [formBiometricId, setFormBiometricId] = useState('');
  const [formHireDate, setFormHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Edit Form fields
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editBranchId, setEditBranchId] = useState<number | ''>('');
  const [editDepartmentId, setEditDepartmentId] = useState<number | ''>('');
  const [editPositionId, setEditPositionId] = useState<number | ''>('');
  const [editScheduleId, setEditScheduleId] = useState<number | ''>('');
  const [editBiometricId, setEditBiometricId] = useState('');
  const [editStatus, setEditStatus] = useState('Active');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActiveMenuEmployeeId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let url = `/v1/employees?page=${page}&pageSize=16`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await api.get(url);
      setEmployees(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalRecords || 0);
    } catch (err: any) {
      console.error(err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogs = async () => {
    try {
      const [branchRes, deptRes, posRes, schedRes] = await Promise.all([
        api.get('/v1/branches'),
        api.get('/v1/departments'),
        api.get('/v1/positions'),
        api.get('/v1/schedules')
      ]);
      setBranches(branchRes.data || []);
      setDepartments(deptRes.data || []);
      setPositions(posRes.data || []);
      setSchedules(schedRes.data || []);
    } catch (err) {
      console.error('Error loading catalogs:', err);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, selectedBranch, selectedStatus, searchTerm]);

  const viewEmployeeDetail = async (id: number) => {
    setActiveMenuEmployeeId(null);
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await api.get(`/v1/employees/${id}`);
      setSelectedEmployeeDetail(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    // Find highest numeric code in existing employees
    const numericCodes = employees
      .map(e => parseInt(e.employeeCode, 10))
      .filter(n => !isNaN(n) && n > 0);
    const nextNum = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : totalRecords + 1;
    const suggestedCode = String(nextNum);

    setFormCode(suggestedCode);
    setFormFirstName('');
    setFormLastName('');
    setFormBranchId(branches.length > 0 ? branches[0].id : '');
    setFormDepartmentId(departments.length > 0 ? departments[0].id : '');
    setFormPositionId(positions.length > 0 ? positions[0].id : '');
    setFormScheduleId(schedules.length > 0 ? schedules[0].id : '');
    setFormBiometricId(suggestedCode);
    setFormHireDate(new Date().toISOString().slice(0, 10));
    setFormEmail('');
    setFormPhone('');
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (emp: any) => {
    setActiveMenuEmployeeId(null);
    setEditingEmployee(emp);
    setEditFirstName(emp.firstName || '');
    setEditLastName(emp.lastName || '');
    setEditBranchId(emp.branchId || (branches.length > 0 ? branches[0].id : ''));
    setEditDepartmentId(emp.departmentId || '');
    setEditPositionId(emp.positionId || '');
    
    // Find matching schedule
    const matchingSched = schedules.find(s => s.name === emp.currentScheduleName);
    setEditScheduleId(matchingSched ? matchingSched.id : (schedules.length > 0 ? schedules[0].id : ''));
    // Strict numeric parity: BiometricExternalId matches employeeCode
    setEditBiometricId(emp.employeeCode || emp.biometricExternalId || '');
    setEditStatus(emp.status || 'Active');
    setEditEmail(emp.email || '');
    setEditPhone(emp.phone || '');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleToggleStatus = async (emp: any) => {
    setActiveMenuEmployeeId(null);
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.put(`/v1/employees/${emp.id}/status`, JSON.stringify(newStatus), {
        headers: { 'Content-Type': 'application/json' }
      });
      setToastMessage(
        isZh
          ? `员工 ${emp.employeeCode} 状态已更新为：${newStatus === 'Active' ? '在职' : '离职'}`
          : `Estado de ${emp.employeeCode} actualizado a: ${newStatus === 'Active' ? 'Activo' : 'Inactivo'}`
      );
      setTimeout(() => setToastMessage(null), 4000);
      fetchEmployees();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      if (!formBranchId) {
        setCreateError(t('employees.ui_por_favor_seleccione_una_sucursal'));
        setCreating(false);
        return;
      }

      // Numeric validation for EmployeeCode and FA200 ID
      const cleanCode = formCode.trim();
      if (!cleanCode || !/^\d+$/.test(cleanCode) || parseInt(cleanCode, 10) <= 0 || parseInt(cleanCode, 10) > 99999999) {
        setCreateError(
          t('employees.ui_el_codigo_de_empleado_e_id')
        );
        setCreating(false);
        return;
      }

      const payload = {
        branchId: Number(formBranchId),
        departmentId: formDepartmentId ? Number(formDepartmentId) : null,
        positionId: formPositionId ? Number(formPositionId) : null,
        scheduleId: formScheduleId ? Number(formScheduleId) : null,
        employeeCode: cleanCode,
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        hireDate: new Date(formHireDate).toISOString(),
        biometricExternalId: cleanCode // Source of truth: identical numeric ID
      };

      await api.post('/v1/employees', payload);

      setCreateModalOpen(false);
      setToastMessage(
        isZh
          ? `员工 ${payload.employeeCode} - ${payload.firstName} ${payload.lastName} 已成功录入`
          : `Empleado #${payload.employeeCode} - ${payload.firstName} registrado con éxito`
      );
      setTimeout(() => setToastMessage(null), 5000);
      fetchEmployees();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || (t('employees.ui_error_al_registrar_el_empleado')));
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setUpdating(true);
    setEditError(null);

    try {
      const payload = {
        branchId: Number(editBranchId),
        departmentId: editDepartmentId ? Number(editDepartmentId) : null,
        positionId: editPositionId ? Number(editPositionId) : null,
        scheduleId: editScheduleId ? Number(editScheduleId) : null,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        terminationDate: null,
        biometricExternalId: editingEmployee.employeeCode, // Inmutable numeric identity
        status: editStatus
      };

      await api.put(`/v1/employees/${editingEmployee.id}`, payload);

      setEditModalOpen(false);
      setToastMessage(
        isZh
          ? `员工 ${editingEmployee.employeeCode} 资料已更新`
          : `Datos del empleado ${editingEmployee.employeeCode} actualizados correctamente`
      );
      setTimeout(() => setToastMessage(null), 5000);
      fetchEmployees();
    } catch (err: any) {
      setEditError(err.response?.data?.message || (t('employees.ui_error_al_actualizar_el_empleado')));
    } finally {
      setUpdating(false);
    }
  };

  // Color generator for avatar based on name
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-indigo-600 to-violet-600',
      'from-blue-600 to-cyan-600',
      'from-emerald-600 to-teal-600',
      'from-amber-600 to-orange-600',
      'from-rose-600 to-pink-600',
      'from-purple-600 to-fuchsia-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const activeFiltersCount = (selectedBranch ? 1 : 0) + (selectedStatus ? 1 : 0) + (searchTerm ? 1 : 0);

  return (
    <div className="space-y-5 max-w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <Users className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>{t('menu.employees')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('employees.ui_padron_general_de_colaboradores_turnos_asignados')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle: Grid vs Table with localStorage persistence */}
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
              title={t('employees.ui_vista_en_cuadricula_de_tarjetas_mosaico')}
              aria-label={t('employees.ui_vista_en_cuadricula')}
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
              title={t('employees.ui_vista_en_tabla_compacta_lista')}
              aria-label={t('employees.ui_vista_en_tabla')}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00695F] hover:bg-[#005149] active:bg-[#003d37] text-white text-xs font-semibold shadow-xs transition cursor-pointer min-h-[42px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('employees.ui_dar_de_alta_empleado')}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Responsive for Desktop and Mobile) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Mobile Filter Toggle Header */}
        <div className="flex sm:hidden items-center justify-between">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl min-h-[42px] cursor-pointer"
          >
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>{t('employees.ui_filtros_y_busqueda')}</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={() => { setSelectedBranch(''); setSelectedStatus(''); setSearchTerm(''); setPage(1); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline p-2"
            >
              {t('employees.ui_limpiar')}
            </button>
          )}
        </div>

        {/* Filter Inputs (collapsible on mobile, grid on desktop) */}
        <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:grid sm:grid-cols-12 gap-3 text-xs`}>
          {/* Search box */}
          <div className="relative col-span-12 sm:col-span-6 lg:col-span-5">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={t('employees.ui_buscar_por_nombre_codigo_o_correo')}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-medium"
            />
          </div>

          {/* Branch filter */}
          <div className="col-span-12 sm:col-span-3 lg:col-span-4 mt-2 sm:mt-0">
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-medium"
            >
              <option value="">{t('common.allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="col-span-12 sm:col-span-3 lg:col-span-3 mt-2 sm:mt-0">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-medium"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="Active">{t('employees.ui_activo')}</option>
              <option value="Inactive">{t('employees.ui_inactivo')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={fetchEmployees} />
      ) : employees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            {t('employees.ui_no_se_encontraron_empleados_con_los')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('employees.ui_intenta_ajustar_los_terminos_de_busqueda')}
          </p>
        </div>
      ) : (
        <CatalogCollection mode={viewMode} permission="employees.manage" onView={emp => viewEmployeeDetail(emp.id)} onEdit={handleOpenEditModal} onToggle={handleToggleStatus}
          rows={employees.map(emp => ({ id: emp.id, name: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' '), code: String(emp.employeeCode || '—'), status: emp.status, source: emp,
            fields: [{ label: t('common.branch'), value: emp.branchName }, { label: t('common.position'), value: emp.positionName }, { label: t('common.schedule'), value: emp.currentScheduleName }, { label: t('common.deviceId'), value: emp.biometricExternalId || emp.employeeCode }],
            secondary: [{ label: t('common.department'), value: emp.departmentName }, { label: t('catalog.email'), value: emp.email }, { label: t('branches.phone'), value: emp.phone }]
          }))} />
      )}

      {/* Pagination Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
        <span className="font-medium">
          {isZh ? (
            <>共 <strong className="text-slate-900 font-bold">{totalRecords}</strong> 名员工 · 第 {page} / {totalPages} 页</>
          ) : (
            <>{t('employees.total')}: <strong className="text-slate-900 font-bold">{totalRecords}</strong> {t('employees.people')} · {t('employees.page')} {page} {t('employees.of')} {totalPages} {t('employees.pages')}</>
          )}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer min-h-[40px]"
          >
            {isZh ? '上一页' : t('common.previous')}
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer min-h-[40px]"
          >
            {isZh ? '下一页' : t('common.next')}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: CREATE EMPLOYEE (Touch-friendly & Responsive)          */}
      {/* ============================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col relative border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header (Sticky) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {t('employees.ui_dar_de_alta_nuevo_empleado')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('employees.ui_registro_en_el_padron_y_vinculacion')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {createError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{createError}</span>
                </div>
              )}

              <form id="create-employee-form" onSubmit={handleCreateSubmit} className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Code */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_codigo_de_empleado_solo_digitos')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={formCode}
                      onChange={(e) => {
                        const numericOnly = e.target.value.replace(/\D/g, '');
                        setFormCode(numericOnly);
                        setFormBiometricId(numericOnly);
                      }}
                      placeholder="1, 2, 4..."
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:bg-white focus:border-[#00695F] focus:outline-none min-h-[42px]"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {t('employees.ui_entero_positivo_fuente_unica_de_verdad')}
                    </span>
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_nombre_s')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      placeholder={t('employees.ui_juan_carlos')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_apellidos')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      placeholder={t('employees.ui_garcia_lopez')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Branch */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_sucursal_de_adscripcion')}
                    </label>
                    <select
                      required
                      value={formBranchId}
                      onChange={(e) => setFormBranchId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_seleccione_sucursal')}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_turno_horario_asignado')}
                    </label>
                    <select
                      value={formScheduleId}
                      onChange={(e) => setFormScheduleId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_seleccione_horario')}</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Department */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('common.department')}
                    </label>
                    <select
                      value={formDepartmentId}
                      onChange={(e) => setFormDepartmentId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_sin_departamento_general')}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('common.position')}
                    </label>
                    <select
                      value={formPositionId}
                      onChange={(e) => setFormPositionId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_sin_puesto_especifico')}</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Biometric ID */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_id_en_checador_biometrico')}
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formCode}
                      className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[#00695F] font-mono font-bold cursor-not-allowed min-h-[42px]"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {t('employees.ui_espejo_automatico_del_codigo_de_empleado')}
                    </span>
                  </div>

                  {/* Hire Date */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_fecha_de_ingreso')}
                    </label>
                    <input
                      type="date"
                      required
                      value={formHireDate}
                      onChange={(e) => setFormHireDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Email */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_correo_electronico_opcional')}
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="empleado@hualong.com"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_telefono_opcional')}
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="477 123 4567"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm min-h-[44px] cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="create-employee-form"
                disabled={creating}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                {creating ? (t('employees.ui_registrando')) : (t('employees.ui_registrar_empleado'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT EMPLOYEE (Touch-friendly & Responsive)            */}
      {/* ============================================================== */}
      {editModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col relative border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header (Sticky) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {t('employees.ui_editar_datos_de_empleado')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    #{editingEmployee.employeeCode} · {editingEmployee.firstName} {editingEmployee.lastName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {editError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{editError}</span>
                </div>
              )}

              <form id="edit-employee-form" onSubmit={handleEditSubmit} className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* First Name */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_nombre_s')}
                    </label>
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_apellidos')}
                    </label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Branch */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_sucursal_de_adscripcion')}
                    </label>
                    <select
                      required
                      value={editBranchId}
                      onChange={(e) => setEditBranchId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_turno_horario_asignado')}
                    </label>
                    <select
                      value={editScheduleId}
                      onChange={(e) => setEditScheduleId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_seleccione_horario')}</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Department */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('common.department')}
                    </label>
                    <select
                      value={editDepartmentId}
                      onChange={(e) => setEditDepartmentId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_sin_departamento_general')}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('common.position')}
                    </label>
                    <select
                      value={editPositionId}
                      onChange={(e) => setEditPositionId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{t('employees.ui_sin_puesto_especifico')}</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Status */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_estado_de_empleado')}
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="Active">{t('employees.ui_activo_active')}</option>
                      <option value="Inactive">{t('employees.ui_inactivo_baja_inactive')}</option>
                    </select>
                  </div>

                  {/* Biometric ID */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_id_en_checador_biometrico')}
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={editingEmployee.employeeCode}
                      className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[#00695F] font-mono font-bold cursor-not-allowed min-h-[42px]"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {t('employees.ui_identidad_protegida_identica_al_codigo_de')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Email */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_correo_electronico')}
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {t('employees.ui_telefono')}
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm min-h-[44px] cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="edit-employee-form"
                disabled={updating}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                {updating ? (t('employees.ui_guardando')) : (t('employees.ui_guardar_cambios'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: EMPLOYEE DETAIL PROFILE & MONTHLY METRICS             */}
      {/* ============================================================== */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col relative border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header (Sticky) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {t('employees.ui_expediente_y_metricas_de_asistencia')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedEmployeeDetail?.fullName || (t('employees.ui_detalle_2'))}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {detailLoading || !selectedEmployeeDetail ? (
                <div className="py-16 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
                  <Clock className="w-6 h-6 animate-spin text-indigo-600" />
                  <span>{isZh ? '正在计算当月考勤汇总...' : t('common.loading')}</span>
                </div>
              ) : (
                <>
                  {/* Employee Identity Card */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                        selectedEmployeeDetail.fullName
                      )} flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0`}
                    >
                      {selectedEmployeeDetail.firstName?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 break-words leading-snug">
                        {selectedEmployeeDetail.fullName}
                      </h3>
                      <p className="text-xs text-indigo-700 font-mono font-semibold mt-0.5">
                        #{selectedEmployeeDetail.employeeCode} · {selectedEmployeeDetail.branchName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            selectedEmployeeDetail.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {selectedEmployeeDetail.status === 'Active'
                            ? (t('employees.ui_activo_2'))
                            : (t('employees.ui_inactivo_2'))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Metrics Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                      {t('employees.ui_metricas_del_mes_en_curso')}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">
                          {t('employees.ui_checadas')}
                        </span>
                        <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                          {selectedEmployeeDetail.totalPunchesThisMonth}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60">
                        <span className="text-[11px] text-emerald-800 font-medium block">
                          {t('employees.ui_dias_presente')}
                        </span>
                        <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                          {selectedEmployeeDetail.daysPresentThisMonth}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60">
                        <span className="text-[11px] text-amber-800 font-medium block">
                          {t('employees.ui_dias_retardo')}
                        </span>
                        <p className="text-xl font-bold font-mono text-amber-700 mt-1">
                          {selectedEmployeeDetail.daysLateThisMonth}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/60">
                        <span className="text-[11px] text-indigo-800 font-medium block">
                          {t('employees.ui_horas_netas')}
                        </span>
                        <p className="text-xl font-bold font-mono text-indigo-700 mt-1">
                          {Math.round((selectedEmployeeDetail.totalMinutesWorkedThisMonth / 60) * 10) / 10}h
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Extended Adscription & Device mapping */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('common.department')}:</span>
                        <span className="font-semibold text-slate-800">{selectedEmployeeDetail.departmentName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('common.position')}:</span>
                        <span className="font-semibold text-slate-800">{selectedEmployeeDetail.positionName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('common.schedule')}:</span>
                        <span className="font-semibold text-emerald-700">{selectedEmployeeDetail.currentScheduleName || (t('employees.ui_turno_estandar_2'))}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('employees.ui_fecha_ingreso')}</span>
                        <span className="font-mono text-slate-800 font-medium">{selectedEmployeeDetail.hireDate?.slice(0, 10)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('employees.ui_id_en_fa200')}</span>
                        <span className="font-mono text-amber-800 font-bold">{selectedEmployeeDetail.biometricExternalId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('employees.ui_horas_extra')}</span>
                        <span className="font-mono text-indigo-700 font-semibold">{selectedEmployeeDetail.totalOvertimeMinutesThisMonth} min</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm min-h-[44px] cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
