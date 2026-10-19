import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import {
  Users,
  Search,
  Eye,
  X,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Fingerprint,
  Briefcase
} from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { t, language } = useLanguage();

  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  // Profile modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Employee modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form fields
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

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = `/v1/employees?page=${page}&pageSize=15`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
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
  }, [page, selectedBranch, searchTerm]);

  const viewEmployeeDetail = async (id: number) => {
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
    // Generate next employee code suggestion
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      if (!formBranchId) {
        setCreateError(language === 'zh-CN' ? '请选择所属分店' : 'Por favor seleccione una sucursal');
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
        language === 'zh-CN'
          ? `员工 ${payload.employeeCode} - ${payload.firstName} ${payload.lastName} 已成功录入`
          : `Empleado ${payload.employeeCode} - ${payload.firstName} registrado con éxito`
      );
      setTimeout(() => setToastMessage(null), 5000);
      fetchEmployees();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Error al registrar el empleado');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>{t('menu.employees')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN' ? '华龙商业集团员工花名册与生物识别编号映射' : 'Padrón de empleados y mapeo biométrico'}
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{language === 'zh-CN' ? '添加新员工' : 'Dar de Alta Empleado'}</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{t('common.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold whitespace-nowrap">
                <tr>
                  <th className="py-3 px-4">{t('common.code')}</th>
                  <th className="py-3 px-4">{t('common.name')}</th>
                  <th className="py-3 px-4">{t('common.branch')}</th>
                  <th className="py-3 px-4">{t('common.department')}</th>
                  <th className="py-3 px-4">{t('common.position')}</th>
                  <th className="py-3 px-4">{t('common.deviceId')}</th>
                  <th className="py-3 px-4">{t('common.schedule')}</th>
                  <th className="py-3 px-4">{t('common.status')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 whitespace-nowrap">{emp.employeeCode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">{emp.firstName} {emp.lastName}</td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{emp.branchName}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{emp.departmentName || '-'}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{emp.positionName || '-'}</td>
                    <td className="py-3 px-4 font-mono text-amber-700 font-medium whitespace-nowrap">{emp.biometricExternalId}</td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded text-xs font-semibold border border-emerald-200/60 whitespace-nowrap inline-flex items-center">
                        {emp.currentScheduleName || (language === 'zh-CN' ? '标准白班' : 'Turno Estándar')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap inline-flex items-center ${
                        emp.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {emp.status === 'Active' ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => viewEmployeeDetail(emp.id)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50 transition cursor-pointer"
                        title={language === 'zh-CN' ? '查看个人考勤月历与指标' : 'Ver detalle de asistencia'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            {language === 'zh-CN' ? (
              <>共 <strong className="text-slate-900 font-semibold">{totalRecords}</strong> 名员工 · 第 {page} / {totalPages} 页</>
            ) : (
              <>Total: <strong className="text-slate-900 font-semibold">{totalRecords}</strong> empleados · Pág. {page} de {totalPages}</>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-md shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-md shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create Employee (Dar de Alta) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 relative border border-slate-200 shadow-2xl my-8">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {language === 'zh-CN' ? '录入新员工' : 'Dar de Alta Nuevo Empleado'}
                </h2>
                <p className="text-xs text-slate-500">
                  {language === 'zh-CN'
                    ? '登记基本信息并与 FA200 考勤机分配生物识别识别码'
                    : 'Registro en el padrón y vinculación con el checador biométrico FA200'}
                </p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Employee Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '员工编号 *' : 'Código de Empleado *'}
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '名字 (First Name) *' : 'Nombre(s) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder={language === 'zh-CN' ? '例如: 芳 / Carlos' : 'Juan Carlos'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '姓氏 (Last Name) *' : 'Apellidos *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder={language === 'zh-CN' ? '例如: 李 / García' : 'García López'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '所属分店 *' : 'Sucursal de Adscripción *'}
                  </label>
                  <select
                    required
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">{language === 'zh-CN' ? '请选择分店...' : 'Seleccione sucursal...'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                {/* Schedule */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '分配排班班次' : 'Turno / Horario Asignado'}
                  </label>
                  <select
                    value={formScheduleId}
                    onChange={(e) => setFormScheduleId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">{language === 'zh-CN' ? '请选择排班...' : 'Seleccione horario...'}</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('common.department')}
                  </label>
                  <select
                    value={formDepartmentId}
                    onChange={(e) => setFormDepartmentId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">{language === 'zh-CN' ? '未指定部门 / 综合' : 'Sin departamento / General'}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('common.position')}
                  </label>
                  <select
                    value={formPositionId}
                    onChange={(e) => setFormPositionId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">{language === 'zh-CN' ? '未指定特定职位' : 'Sin puesto específico'}</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Biometric External ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '考勤机识别编码 (Device ID)' : 'ID en Dispositivo Biométrico'}
                  </label>
                  <input
                    type="text"
                    value={formBiometricId}
                    onChange={(e) => setFormBiometricId(e.target.value)}
                    placeholder="HL-061"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'zh-CN' ? '与 FA200 考勤机内存储的工号对应' : 'Número o ID con el que se registrará su huella/rostro en el FA200.'}
                  </span>
                </div>

                {/* Hire Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '入职日期 *' : 'Fecha de Ingreso *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formHireDate}
                    onChange={(e) => setFormHireDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '电子邮箱 (选填)' : 'Correo Electrónico (Opcional)'}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="empleado@hualong.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'zh-CN' ? '联系电话 (选填)' : 'Teléfono (Opcional)'}
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="55 1234 5678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg text-xs transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {creating ? (language === 'zh-CN' ? '正在录入...' : 'Registrando...') : (language === 'zh-CN' ? '确认录入员工' : 'Registrar Empleado')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Detail Profile Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 relative border border-slate-200 shadow-2xl">
            <button
              onClick={() => setDetailModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading || !selectedEmployeeDetail ? (
              <div className="py-12 text-center text-slate-400 text-xs">{t('common.loading')}</div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-100">
                    {selectedEmployeeDetail.firstName?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedEmployeeDetail.fullName}
                    </h2>
                    <p className="text-xs text-indigo-600 font-mono mt-0.5 font-semibold">
                      {selectedEmployeeDetail.employeeCode} · {selectedEmployeeDetail.branchName}
                    </p>
                  </div>
                </div>

                {/* Profile Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {language === 'zh-CN' ? '当月打卡次数' : 'Checadas del Mes'}
                    </span>
                    <p className="text-lg font-bold text-slate-900 mt-1">{selectedEmployeeDetail.totalPunchesThisMonth}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {language === 'zh-CN' ? '出勤天数' : 'Días Presente'}
                    </span>
                    <p className="text-lg font-bold text-emerald-600 mt-1">{selectedEmployeeDetail.daysPresentThisMonth}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {language === 'zh-CN' ? '迟到天数' : 'Días Retardo'}
                    </span>
                    <p className="text-lg font-bold text-amber-600 mt-1">{selectedEmployeeDetail.daysLateThisMonth}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {language === 'zh-CN' ? '累计工时' : 'Horas Trabajadas'}
                    </span>
                    <p className="text-lg font-bold text-indigo-600 mt-1">
                      {Math.round((selectedEmployeeDetail.totalMinutesWorkedThisMonth / 60) * 10) / 10}h
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">{t('common.department')}: <span className="text-slate-800 font-semibold">{selectedEmployeeDetail.departmentName || '-'}</span></div>
                    <div className="text-slate-500">{t('common.position')}: <span className="text-slate-800 font-semibold">{selectedEmployeeDetail.positionName || '-'}</span></div>
                    <div className="text-slate-500">{t('common.schedule')}: <span className="text-emerald-700 font-semibold">{selectedEmployeeDetail.currentScheduleName || (language === 'zh-CN' ? '标准白班' : 'Turno Estándar')}</span></div>
                  </div>
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">{language === 'zh-CN' ? '入职日期:' : 'Fecha Ingreso:'} <span className="text-slate-800 font-mono font-medium">{selectedEmployeeDetail.hireDate?.slice(0, 10)}</span></div>
                    <div className="text-slate-500">{t('common.deviceId')}: <span className="text-amber-700 font-mono font-bold">{selectedEmployeeDetail.biometricExternalId}</span></div>
                    <div className="text-slate-500">{language === 'zh-CN' ? '加班分钟:' : 'Horas Extra (min):'} <span className="text-indigo-600 font-mono font-semibold">{selectedEmployeeDetail.totalOvertimeMinutesThisMonth} min</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
