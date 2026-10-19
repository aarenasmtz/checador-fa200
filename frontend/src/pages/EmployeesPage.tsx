import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
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

  // View mode: 'grid' (cards) or 'table' (compact)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
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
    try {
      let url = `/v1/employees?page=${page}&pageSize=16`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await api.get(url);
      setEmployees(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalRecords || 0);
    } catch (err) {
      console.error(err);
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
    const nextNum = totalRecords + 1;
    const suggestedCode = `HL-${String(nextNum).padStart(3, '0')}`;

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
    setEditBiometricId(emp.biometricExternalId || emp.employeeCode || '');
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
        setCreateError(isZh ? '请选择所属分店' : 'Por favor seleccione una sucursal');
        setCreating(false);
        return;
      }

      const payload = {
        branchId: Number(formBranchId),
        departmentId: formDepartmentId ? Number(formDepartmentId) : null,
        positionId: formPositionId ? Number(formPositionId) : null,
        scheduleId: formScheduleId ? Number(formScheduleId) : null,
        employeeCode: formCode.trim().toUpperCase(),
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        hireDate: new Date(formHireDate).toISOString(),
        biometricExternalId: formBiometricId.trim() || formCode.trim().toUpperCase()
      };

      await api.post('/v1/employees', payload);

      setCreateModalOpen(false);
      setToastMessage(
        isZh
          ? `员工 ${payload.employeeCode} - ${payload.firstName} ${payload.lastName} 已成功录入`
          : `Empleado ${payload.employeeCode} - ${payload.firstName} registrado con éxito`
      );
      setTimeout(() => setToastMessage(null), 5000);
      fetchEmployees();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || (isZh ? '录入员工失败' : 'Error al registrar el empleado'));
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
        biometricExternalId: editBiometricId.trim() || editingEmployee.employeeCode,
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
      setEditError(err.response?.data?.message || (isZh ? '更新失败' : 'Error al actualizar el empleado'));
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
            {isZh
              ? '华龙商业集团员工花名册 · 门店 adscripción 与 FA200 生物识别工号'
              : 'Padrón general de colaboradores, turnos asignados y vinculación biométrica FA200'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title={isZh ? '网格卡片视图' : 'Vista en cuadrícula de tarjetas'}
              aria-label={isZh ? '网格卡片视图' : 'Vista en cuadrícula'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title={isZh ? '表格视图' : 'Vista en tabla compacta'}
              aria-label={isZh ? '表格视图' : 'Vista en tabla'}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer min-h-[42px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isZh ? '添加新员工' : 'Dar de Alta Empleado'}</span>
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
            <span>{isZh ? '筛选与搜索' : 'Filtros y Búsqueda'}</span>
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
              {isZh ? '重置' : 'Limpiar'}
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
              placeholder={isZh ? '搜索员工姓名、编号或邮箱...' : 'Buscar por nombre, código o correo...'}
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
              <option value="Active">{isZh ? '在职 (Activo)' : 'Activo'}</option>
              <option value="Inactive">{isZh ? '离职 (Inactivo)' : 'Inactivo'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2 shadow-xs">
          <Users className="w-8 h-8 animate-bounce text-indigo-600" />
          <span>{isZh ? '正在载入员工花名册...' : t('common.loading')}</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            {isZh ? '未找到符合条件的员工记录' : 'No se encontraron empleados con los filtros seleccionados'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isZh ? '请尝试修改搜索词或筛选条件' : 'Intenta ajustar los términos de búsqueda o cambiar de sucursal'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ============================================================== */
        /* 1. ADAPTIVE GRID VIEW (1 col mobile, 2 tablet, 3-4 desktop)     */
        /* ============================================================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map((emp) => {
            const fullName = `${emp.firstName} ${emp.lastName}`.trim();
            const initials = `${emp.firstName?.charAt(0) || ''}${emp.lastName?.charAt(0) || ''}`.toUpperCase() || 'HL';
            const isActive = emp.status === 'Active';
            const isMenuOpen = activeMenuEmployeeId === emp.id;

            return (
              <div
                key={emp.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between relative group"
              >
                {/* Card Top: Avatar, Name, Code and Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Gradient Avatar */}
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                          fullName
                        )} flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0`}
                      >
                        {initials}
                      </div>

                      {/* Name and Code */}
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words">
                          {fullName}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md text-[11px] font-bold border border-indigo-100">
                            #{emp.employeeCode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {isActive ? (isZh ? '在职' : t('common.active')) : (isZh ? '离职' : t('common.inactive'))}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Relevant Metadata */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs">
                    {/* Branch */}
                    <div className="flex items-start gap-2 text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="font-medium break-words leading-tight">{emp.branchName}</span>
                    </div>

                    {/* Department & Position */}
                    {(emp.departmentName || emp.positionName) && (
                      <div className="flex items-start gap-2 text-slate-500">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate leading-tight">
                          {emp.positionName || (isZh ? '综合职能' : 'Puesto General')}
                          {emp.departmentName ? ` · ${emp.departmentName}` : ''}
                        </span>
                      </div>
                    )}

                    {/* Assigned Schedule */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-emerald-800 bg-emerald-50/70 border border-emerald-200/60 px-2 py-0.5 rounded-md text-[11px] truncate">
                        {emp.currentScheduleName || (isZh ? '标准排班' : 'Turno Estándar')}
                      </span>
                    </div>

                    {/* FA200 Biometric Device ID */}
                    <div className="flex items-center gap-2 text-slate-600 pt-0.5">
                      <Fingerprint className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-[11px]">
                        {isZh ? '考勤机工号: ' : 'ID FA200: '}
                        <strong className="font-mono text-amber-800 font-bold">
                          {emp.biometricExternalId || emp.employeeCode}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Icon Actions (Touch targets >= 44x44 px) */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {/* 1. View Detail / Metrics (Eye Icon) */}
                    <button
                      type="button"
                      onClick={() => viewEmployeeDetail(emp.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition cursor-pointer min-h-[44px] text-xs font-semibold"
                      title={isZh ? '查看个人打卡月历与工时统计' : 'Consultar expediente y checadas del mes'}
                      aria-label={isZh ? '查看考勤明细' : 'Ver detalle'}
                    >
                      <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{isZh ? '详情' : 'Detalle'}</span>
                    </button>

                    {/* 2. Edit Employee (Edit3 Icon) */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white transition cursor-pointer min-h-[44px] text-xs font-semibold"
                      title={isZh ? '修改员工信息与所属排班' : 'Editar empleado y horario'}
                      aria-label={isZh ? '编辑' : 'Editar'}
                    >
                      <Edit3 className="w-4 h-4 shrink-0" />
                      <span>{isZh ? '编辑' : 'Editar'}</span>
                    </button>
                  </div>

                  {/* 3. Three dots options dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuEmployeeId(isMenuOpen ? null : emp.id)}
                      className="w-[44px] h-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                      title={isZh ? '更多操作' : 'Más opciones'}
                      aria-label={isZh ? '更多操作' : 'Más opciones'}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Menu */}
                    {isMenuOpen && (
                      <div
                        ref={actionMenuRef}
                        className="absolute right-0 bottom-full mb-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 text-xs animate-scaleUp overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp)}
                          className="w-full text-left px-3.5 py-2.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 transition cursor-pointer font-medium"
                        >
                          <Power className={`w-3.5 h-3.5 ${isActive ? 'text-rose-500' : 'text-emerald-500'}`} />
                          <span>
                            {isActive
                              ? (isZh ? '设为离职 (Inactivo)' : 'Marcar Inactivo')
                              : (isZh ? '恢复在职 (Activo)' : 'Reactivar Empleado')}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ============================================================== */
        /* 2. COMPACT TABLE VIEW (Responsive without horizontal overflow) */
        /* ============================================================== */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="w-full">
            <table className="w-full text-left text-xs border-collapse border border-slate-200 table-fixed">
              <thead className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200 font-semibold text-xs">
                <tr>
                  <th className="py-3 px-3.5 w-[28%] border-r border-slate-200">{isZh ? '员工 / 编号' : 'Empleado y Código'}</th>
                  <th className="py-3 px-3 w-[22%] border-r border-slate-200 hidden sm:table-cell">{isZh ? '门店与岗位' : 'Sucursal y Puesto'}</th>
                  <th className="py-3 px-3 w-[22%] border-r border-slate-200 hidden md:table-cell">{isZh ? '排班与考勤机ID' : 'Horario y FA200'}</th>
                  <th className="py-3 px-3 w-[12%] border-r border-slate-200 text-center">{t('common.status')}</th>
                  <th className="py-3 px-3.5 w-[16%] text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((emp, idx) => {
                  const isEven = idx % 2 === 0;
                  const isActive = emp.status === 'Active';
                  return (
                    <tr
                      key={emp.id}
                      className={`border-b border-slate-200 transition ${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/40`}
                    >
                      {/* Name & Code */}
                      <td className="py-3 px-3.5 align-middle border-r border-slate-200">
                        <div className="font-bold text-slate-900 text-sm leading-snug break-words">
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 text-[11px]">
                            #{emp.employeeCode}
                          </span>
                          <span className="sm:hidden text-slate-400">·</span>
                          <span className="sm:hidden text-slate-600 truncate">{emp.branchName}</span>
                        </div>
                      </td>

                      {/* Branch & Position (Visible on sm+) */}
                      <td className="py-3 px-3 align-middle border-r border-slate-200 hidden sm:table-cell">
                        <div className="font-medium text-slate-800 truncate">{emp.branchName}</div>
                        <div className="text-slate-400 text-[11px] truncate">
                          {emp.positionName || (isZh ? '综合职能' : 'General')}
                          {emp.departmentName ? ` · ${emp.departmentName}` : ''}
                        </div>
                      </td>

                      {/* Schedule & FA200 (Visible on md+) */}
                      <td className="py-3 px-3 align-middle border-r border-slate-200 hidden md:table-cell">
                        <div className="font-semibold text-emerald-800 text-[11px] truncate">
                          {emp.currentScheduleName || (isZh ? '标准班次' : 'Turno Estándar')}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID FA200: <strong className="text-amber-800">{emp.biometricExternalId || emp.employeeCode}</strong>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 align-middle text-center border-r border-slate-200">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isActive ? (isZh ? '在职' : t('common.active')) : (isZh ? '离职' : t('common.inactive'))}
                        </span>
                      </td>

                      {/* Actions with Lucide Icons */}
                      <td className="py-3 px-3.5 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Eye: View Detail */}
                          <button
                            type="button"
                            onClick={() => viewEmployeeDetail(emp.id)}
                            className="w-[38px] h-[38px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 transition cursor-pointer"
                            title={isZh ? '查看考勤月历与指标' : 'Consultar checadas del mes'}
                            aria-label={isZh ? '查看详情' : 'Ver detalle'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit: Open Edit Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="w-[38px] h-[38px] flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition cursor-pointer"
                            title={isZh ? '修改员工与排班' : 'Editar empleado'}
                            aria-label={isZh ? '编辑' : 'Editar'}
                          >
                            <Edit3 className="w-4 h-4" />
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

      {/* Pagination Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
        <span className="font-medium">
          {isZh ? (
            <>共 <strong className="text-slate-900 font-bold">{totalRecords}</strong> 名员工 · 第 {page} / {totalPages} 页</>
          ) : (
            <>Total: <strong className="text-slate-900 font-bold">{totalRecords}</strong> empleados · Pág. {page} de {totalPages}</>
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
                    {isZh ? '录入新员工' : 'Dar de Alta Nuevo Empleado'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isZh
                      ? '登记基本信息并分配 FA200 硬件生物识别编码'
                      : 'Registro en el padrón y vinculación con checador biométrico FA200'}
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
                      {isZh ? '员工编号 *' : 'Código de Empleado *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => {
                        setFormCode(e.target.value);
                        if (!formBiometricId || formBiometricId === formCode) {
                          setFormBiometricId(e.target.value);
                        }
                      }}
                      placeholder="HL-061"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-semibold focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '名字 (First Name) *' : 'Nombre(s) *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      placeholder={isZh ? '例如: 芳 / Carlos' : 'Juan Carlos'}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '姓氏 (Last Name) *' : 'Apellidos *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      placeholder={isZh ? '例如: 李 / García' : 'García López'}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Branch */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '所属分店 *' : 'Sucursal de Adscripción *'}
                    </label>
                    <select
                      required
                      value={formBranchId}
                      onChange={(e) => setFormBranchId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{isZh ? '请选择分店...' : 'Seleccione sucursal...'}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '分配排班班次' : 'Turno / Horario Asignado'}
                    </label>
                    <select
                      value={formScheduleId}
                      onChange={(e) => setFormScheduleId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{isZh ? '请选择排班...' : 'Seleccione horario...'}</option>
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
                      <option value="">{isZh ? '未指定部门 / 综合' : 'Sin departamento / General'}</option>
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
                      <option value="">{isZh ? '未指定特定职位' : 'Sin puesto específico'}</option>
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
                      {isZh ? '考勤机识别编码 (FA200 ID)' : 'ID en Checador Biométrico'}
                    </label>
                    <input
                      type="text"
                      value={formBiometricId}
                      onChange={(e) => setFormBiometricId(e.target.value)}
                      placeholder="HL-061"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {isZh ? '与 FA200 硬件面部/指纹机中录入的员工号对应' : 'ID con el que se enrolará su huella/rostro en el FA200.'}
                    </span>
                  </div>

                  {/* Hire Date */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '入职日期 *' : 'Fecha de Ingreso *'}
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
                      {isZh ? '电子邮箱 (选填)' : 'Correo Electrónico (Opcional)'}
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
                      {isZh ? '联系电话 (选填)' : 'Teléfono (Opcional)'}
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
                {creating ? (isZh ? '正在录入...' : 'Registrando...') : (isZh ? '确认录入员工' : 'Registrar Empleado')}
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
                    {isZh ? '修改员工资料' : 'Editar Datos de Empleado'}
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
                      {isZh ? '名字 (First Name) *' : 'Nombre(s) *'}
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
                      {isZh ? '姓氏 (Last Name) *' : 'Apellidos *'}
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
                      {isZh ? '所属分店 *' : 'Sucursal de Adscripción *'}
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
                      {isZh ? '分配排班班次' : 'Turno / Horario Asignado'}
                    </label>
                    <select
                      value={editScheduleId}
                      onChange={(e) => setEditScheduleId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="">{isZh ? '请选择排班...' : 'Seleccione horario...'}</option>
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
                      <option value="">{isZh ? '未指定部门 / 综合' : 'Sin departamento / General'}</option>
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
                      <option value="">{isZh ? '未指定特定职位' : 'Sin puesto específico'}</option>
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
                      {isZh ? '在职状态' : 'Estado de Empleado'}
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    >
                      <option value="Active">{isZh ? '在职 (Active)' : 'Activo (Active)'}</option>
                      <option value="Inactive">{isZh ? '离职 / 停用 (Inactive)' : 'Inactivo / Baja (Inactive)'}</option>
                    </select>
                  </div>

                  {/* Biometric ID */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '考勤机识别编码 (FA200 ID)' : 'ID en Checador Biométrico'}
                    </label>
                    <input
                      type="text"
                      value={editBiometricId}
                      onChange={(e) => setEditBiometricId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Email */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '电子邮箱' : 'Correo Electrónico'}
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
                      {isZh ? '联系电话' : 'Teléfono'}
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
                {updating ? (isZh ? '正在保存...' : 'Guardando...') : (isZh ? '保存修改' : 'Guardar Cambios')}
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
                    {isZh ? '员工考勤档案与月度指标' : 'Expediente y Métricas de Asistencia'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedEmployeeDetail?.fullName || (isZh ? '考勤详情' : 'Detalle')}
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
                            ? (isZh ? '正常在职' : 'Activo')
                            : (isZh ? '已离职' : 'Inactivo')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Metrics Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                      {isZh ? '本月考勤实绩 (当月统计)' : 'Métricas del Mes en Curso'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-medium block">
                          {isZh ? '打卡次数' : 'Checadas'}
                        </span>
                        <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                          {selectedEmployeeDetail.totalPunchesThisMonth}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60">
                        <span className="text-[11px] text-emerald-800 font-medium block">
                          {isZh ? '出勤天数' : 'Días Presente'}
                        </span>
                        <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                          {selectedEmployeeDetail.daysPresentThisMonth}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60">
                        <span className="text-[11px] text-amber-800 font-medium block">
                          {isZh ? '迟到天数' : 'Días Retardo'}
                        </span>
                        <p className="text-xl font-bold font-mono text-amber-700 mt-1">
                          {selectedEmployeeDetail.daysLateThisMonth}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/60">
                        <span className="text-[11px] text-indigo-800 font-medium block">
                          {isZh ? '累计工时' : 'Horas Netas'}
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
                        <span className="font-semibold text-emerald-700">{selectedEmployeeDetail.currentScheduleName || (isZh ? '标准班次' : 'Turno Estándar')}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isZh ? '入职日期:' : 'Fecha Ingreso:'}</span>
                        <span className="font-mono text-slate-800 font-medium">{selectedEmployeeDetail.hireDate?.slice(0, 10)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isZh ? 'FA200 硬件工号:' : 'ID en FA200:'}</span>
                        <span className="font-mono text-amber-800 font-bold">{selectedEmployeeDetail.biometricExternalId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isZh ? '加班时长 (min):' : 'Horas Extra:'}</span>
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
