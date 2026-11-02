import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Check,
  X,
  Plus,
  Eye,
  Edit2,
  Ban,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info
} from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { useAuth } from '../context/AuthContext';

interface Incident {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  date: string;
  type: string;
  bilingualType?: string;
  description: string;
  minutes: number;
  punchTime?: string;
  punchMovementType?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  bilingualStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdBy?: string;
  createdAt?: string;
}

interface Branch {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  branchId: number;
}

export const IncidentsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const canManage = user?.permissions?.includes('incidents.manage') || user?.roles?.some(role => ['SUPERADMIN','ADMIN','ADMIN_SUCURSAL','RH'].includes(role));
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References for form
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState<Incident | null>(null);
  const [selectedIncidentForEdit, setSelectedIncidentForEdit] = useState<Incident | null>(null);
  const [selectedIncidentForCancel, setSelectedIncidentForCancel] = useState<Incident | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Form states for Create / Edit
  const [formBranchId, setFormBranchId] = useState<number>(0);
  const [formEmployeeId, setFormEmployeeId] = useState<number>(0);
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formType, setFormType] = useState<string>('JustifiedLate');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formMinutes, setFormMinutes] = useState<number>(15);
  const [formPunchTime, setFormPunchTime] = useState<string>('09:00');
  const [formPunchMovementType, setFormPunchMovementType] = useState<string>('Entry');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [branchesRes, employeesRes] = await Promise.all([
          api.get('/v1/branches'),
          api.get('/v1/employees', { params: { pageSize: 500 } })
        ]);
        setBranches(branchesRes.data || []);
        setEmployees(employeesRes.data.items || employeesRes.data || []);
      } catch (err) {
        console.error('Failed to load dependencies:', err);
      }
    };
    loadDependencies();
  }, []);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get('/v1/incidents', {
        params: {
          page,
          pageSize,
          status: statusFilter || undefined,
          branchId: branchFilter ? parseInt(branchFilter) : undefined,
        },
      });
      setIncidents(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalRecords || 0);
    } catch (err: any) {
      console.error('Failed to load incidents:', err);
      setErrorMsg(err.response?.data?.message || t('incidents.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [page, statusFilter, branchFilter]);

  const handleApprove = async (id: number) => {
    try {
      await api.put(`/v1/incidents/${id}/approve`);
      setActionMsg(t('incidents.ui_incidencia_aprobada_y_asistencia_recalculada_exitosamente'));
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      console.error('Approve failed:', err);
      setErrorMsg(err.response?.data?.message || 'Error al aprobar la incidencia');
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.put(`/v1/incidents/${id}/reject`);
      setActionMsg(t('incidents.ui_incidencia_rechazada'));
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      console.error('Reject failed:', err);
      setErrorMsg(err.response?.data?.message || 'Error al rechazar la incidencia');
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const handleOpenCreate = () => {
    const defaultBranchId = branches.length > 0 ? branches[0].id : 0;
    setFormBranchId(defaultBranchId);
    const branchEmps = employees.filter(e => e.branchId === defaultBranchId);
    setFormEmployeeId(branchEmps.length > 0 ? branchEmps[0].id : 0);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormType('JustifiedLate');
    setFormDescription('');
    setFormMinutes(15);
    setFormPunchTime('09:00');
    setFormPunchMovementType('Entry');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId) {
      alert(t('incidents.ui_por_favor_seleccione_un_empleado'));
      return;
    }
    if (!formDescription.trim()) {
      alert(t('incidents.ui_por_favor_ingrese_el_motivo_de'));
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/v1/incidents', {
        employeeId: formEmployeeId,
        date: formDate,
        type: formType,
        description: formDescription.trim(),
        minutes: formType === 'JustifiedLate' || formType === 'Permission' ? formMinutes : 0,
        punchTime: formType === 'PunchMiss' ? (formPunchTime.length === 5 ? `${formPunchTime}:00` : formPunchTime) : null,
        punchMovementType: formType === 'PunchMiss' ? formPunchMovementType : null
      });

      setShowCreateModal(false);
      setActionMsg(t('incidents.ui_incidencia_registrada_exitosamente'));
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      console.error('Create incident failed:', err);
      alert(err.response?.data?.message || 'Error al registrar la incidencia.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (inc: Incident) => {
    setSelectedIncidentForEdit(inc);
    setFormType(inc.type);
    setFormDescription(inc.description);
    setFormMinutes(inc.minutes || 15);
    setFormPunchTime(inc.punchTime || '09:00');
    setFormPunchMovementType(inc.punchMovementType || 'Entry');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentForEdit) return;

    try {
      setSubmitting(true);
      await api.put(`/v1/incidents/${selectedIncidentForEdit.id}`, {
        type: formType,
        description: formDescription.trim(),
        minutes: formType === 'JustifiedLate' || formType === 'Permission' ? formMinutes : 0,
        punchTime: formType === 'PunchMiss' ? (formPunchTime.length === 5 ? `${formPunchTime}:00` : formPunchTime) : null,
        punchMovementType: formType === 'PunchMiss' ? formPunchMovementType : null
      });

      setSelectedIncidentForEdit(null);
      setActionMsg(t('incidents.ui_incidencia_actualizada_exitosamente'));
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      console.error('Edit incident failed:', err);
      alert(err.response?.data?.message || 'Error al actualizar la incidencia.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentForCancel) return;
    if (!cancelReason.trim()) {
      alert(t('incidents.ui_ingrese_el_motivo_de_cancelacion'));
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/v1/incidents/${selectedIncidentForCancel.id}/cancel`, {
        reason: cancelReason.trim()
      });

      setSelectedIncidentForCancel(null);
      setCancelReason('');
      setActionMsg(t('incidents.ui_incidencia_cancelada_exitosamente'));
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      console.error('Cancel incident failed:', err);
      alert(err.response?.data?.message || 'Error al cancelar la incidencia.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, bilingualStatus?: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            {t('incidents.approved')}
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            {t('incidents.rejected')}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3.5 h-3.5 text-slate-500" />
            {t('incidents.cancelled')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            {t('incidents.pending')}
          </span>
        );
    }
  };

  const renderTypeLabel = (type: string, bilingualType?: string) => {
    switch (type) {
      case 'PunchMiss': return t('incidents.ui_omision_de_checada');
      case 'JustifiedLate': return t('incidents.ui_retardo_justificado');
      case 'JustifiedAbsence': return t('incidents.ui_falta_justificada');
      case 'Permission': return t('incidents.ui_permiso_laboral');
      case 'Vacation': return t('incidents.ui_vacaciones');
      case 'Disability': return t('incidents.ui_incapacidad_medica');
      case 'HomeOffice': return t('incidents.ui_home_office');
      case 'FieldWork': return t('incidents.ui_trabajo_en_campo');
      case 'ScheduleCorrection': return t('incidents.ui_correccion_de_horario');
      default: return type;
    }
  };

  const filteredEmployeesForBranch = formBranchId
    ? employees.filter(e => e.branchId === formBranchId)
    : employees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            {t('incidents.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('incidents.ui_aprobacion_de_incidencias_omisiones_de_checada')}
          </p>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('incidents.ui_nueva_incidencia')}</span>
          </button>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">{t('incidents.ui_todas_las_sucursales')}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">{t('incidents.ui_todos_los_estados')}</option>
            <option value="Pending">{t('incidents.pending')}</option>
            <option value="Approved">{t('incidents.approved')}</option>
            <option value="Rejected">{t('incidents.rejected')}</option>
            <option value="Cancelled">{t('incidents.ui_canceladas')}</option>
          </select>

          <button
            onClick={fetchIncidents}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            title={t('common.refresh')}
          >
            <RefreshCw className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Incidents Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="wpc-mobile-list p-3">
          {loading ? <LoadingState /> : errorMsg ? <ErrorState onRetry={fetchIncidents} message={errorMsg} /> : !incidents.length ? <EmptyState /> : incidents.map(inc => <article key={inc.id} className="wpc-list-card">
            <div className="flex items-start justify-between gap-2"><div><h3>{inc.employeeName}</h3><p className="wpc-card-meta">#{inc.employeeCode} · {inc.date}<br />{inc.branchName}</p></div><button className="wpc-icon-button" aria-label={`${t('incidents.viewDetail')}: ${inc.employeeName}`} onClick={() => setSelectedIncidentForDetail(inc)}><Eye size={20} /></button></div>
            <p className="mt-3 text-sm font-semibold">{renderTypeLabel(inc.type)}</p><p className="mt-1 text-sm text-[#60727E]">{inc.punchTime || (inc.minutes ? `${inc.minutes} ${t('detail.minuteUnit')}` : '—')}</p>
            <details className="wpc-disclosure mt-3"><summary>{t('incidents.reason')}</summary><p className="wpc-disclosure-body">{inc.description}</p></details>
            <div className="wpc-card-footer flex-wrap">{getStatusBadge(inc.status)}{canManage && inc.status === 'Pending' && <div className="flex flex-wrap gap-1"><button className="wpc-icon-button" aria-label={t('incidents.edit')} onClick={() => handleOpenEdit(inc)}><Edit2 size={18} /></button><button className="wpc-icon-button" aria-label={t('incidents.cancel')} onClick={() => setSelectedIncidentForCancel(inc)}><Ban size={18} /></button><button className="wpc-icon-button" aria-label={t('incidents.approve')} onClick={() => handleApprove(inc.id)}><Check size={18} /></button><button className="wpc-icon-button" aria-label={t('incidents.reject')} onClick={() => handleReject(inc.id)}><X size={18} /></button></div>}</div>
          </article>)}
        </div>
        <div className="wpc-desktop-list overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 uppercase text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t('common.date')}</th>
                <th className="px-4 py-3">{t('common.name')}</th>
                <th className="px-4 py-3">{t('common.branch')}</th>
                <th className="px-4 py-3">{t('incidents.type')}</th>
                <th className="px-4 py-3">{t('incidents.detailPunch')}</th>
                <th className="px-4 py-3">{t('incidents.reason')}</th>
                <th className="px-4 py-3">{t('incidents.status')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <p className="font-semibold text-rose-700">{errorMsg}</p>
                    <button type="button" onClick={fetchIncidents} className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">
                      {t('common.retry')}
                    </button>
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    {t('incidents.ui_no_hay_incidencias_registradas_con_este')}
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{inc.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{inc.employeeName}</div>
                      <div className="text-[11px] text-indigo-600 font-mono font-medium">{inc.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{inc.branchName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                        {renderTypeLabel(inc.type, inc.bilingualType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {inc.punchTime ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-semibold">
                          {inc.punchMovementType || 'Punch'}: {inc.punchTime}
                        </span>
                      ) : inc.minutes > 0 ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 font-semibold">
                          {inc.minutes} min
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={inc.description}>
                      {inc.description}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(inc.status, inc.bilingualStatus)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Detail Button */}
                        <button
                          onClick={() => setSelectedIncidentForDetail(inc)}
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-200 transition border border-slate-200 shadow-2xs"
                          title={t('incidents.viewDetail')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Actions for Pending Incidents */}
                        {canManage && inc.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(inc)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition border border-blue-200 shadow-2xs"
                              title={t('incidents.editPending')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedIncidentForCancel(inc)}
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition border border-amber-200 shadow-2xs"
                              title={t('incidents.cancelPending')}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleApprove(inc.id)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition border border-emerald-200 shadow-2xs"
                              title={t('incidents.approve')}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReject(inc.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition border border-rose-200 shadow-2xs"
                              title={t('incidents.reject')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Approved Incidents show approver */}
                        {inc.status === 'Approved' && (
                          <span className="text-[11px] text-slate-500 font-mono" title={`Aprobado por ${inc.approvedBy} el ${inc.approvedAt}`}>
                            ✓ {inc.approvedBy || '-'}
                          </span>
                        )}

                        {/* Cancelled Incidents show cancelledBy */}
                        {inc.status === 'Cancelled' && (
                          <span className="text-[11px] text-slate-400 font-mono" title={`Cancelado por ${inc.cancelledBy}: ${inc.cancellationReason}`}>
                            ✕ {inc.cancelledBy || 'Cancelada'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div>
            {t('catalog.page')} <span className="font-semibold text-slate-800">{page} / {totalPages}</span> · {totalRecords} {t('dashboard.records')}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-medium">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {t('incidents.ui_registrar_nueva_incidencia_o_justificacion')}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              {/* Branch Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('incidents.ui_sucursal')}
                </label>
                <select
                  value={formBranchId}
                  onChange={(e) => {
                    const bId = parseInt(e.target.value);
                    setFormBranchId(bId);
                    const emps = employees.filter(emp => emp.branchId === bId);
                    setFormEmployeeId(emps.length > 0 ? emps[0].id : 0);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('incidents.ui_empleado')}
                </label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">{t('incidents.ui_seleccionar_empleado')}</option>
                  {filteredEmployeesForBranch.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.employeeCode} - {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date and Type Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('incidents.ui_fecha_de_incidencia')}
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('incidents.ui_tipo_de_incidencia')}
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="JustifiedLate">{t('incidents.ui_retardo_justificado_2')}</option>
                    <option value="PunchMiss">{t('incidents.ui_omision_de_checada_2')}</option>
                    <option value="JustifiedAbsence">{t('incidents.ui_falta_justificada_2')}</option>
                    <option value="Permission">{t('incidents.ui_permiso_laboral_2')}</option>
                    <option value="Vacation">{t('incidents.ui_vacaciones_2')}</option>
                    <option value="Disability">{t('incidents.ui_incapacidad_medica_2')}</option>
                    <option value="HomeOffice">{t('incidents.ui_home_office')}</option>
                    <option value="FieldWork">{t('incidents.ui_trabajo_en_campo_2')}</option>
                    <option value="ScheduleCorrection">{t('incidents.ui_correccion_de_horario_2')}</option>
                  </select>
                </div>
              </div>

              {/* Conditional fields based on type */}
              {formType === 'PunchMiss' && (
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">
                      {t('incidents.ui_movimiento_a_justificar')}
                    </label>
                    <select
                      value={formPunchMovementType}
                      onChange={(e) => setFormPunchMovementType(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="Entry">{t('incidents.ui_entrada')}</option>
                      <option value="MealExit">{t('incidents.ui_salida_a_comida')}</option>
                      <option value="MealReturn">{t('incidents.ui_regreso_de_comida')}</option>
                      <option value="Exit">{t('incidents.ui_salida')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">
                      {t('incidents.ui_hora_de_checada')}
                    </label>
                    <input
                      type="time"
                      value={formPunchTime}
                      onChange={(e) => setFormPunchTime(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {(formType === 'JustifiedLate' || formType === 'Permission') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('incidents.ui_minutos_a_justificar_o_exonerar')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={formMinutes}
                    onChange={(e) => setFormMinutes(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('incidents.ui_motivo_justificacion')}
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('incidents.reasonPlaceholder')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Registrar Incidencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedIncidentForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {t('incidents.ui_detalle_de_la_incidencia')}
                </h2>
              </div>
              <button
                onClick={() => setSelectedIncidentForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{selectedIncidentForDetail.employeeName}</div>
                <div className="text-indigo-600 font-mono font-semibold">{selectedIncidentForDetail.employeeCode} · {selectedIncidentForDetail.branchName}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('common.date')}:</span>
                  <span className="font-mono font-semibold">{selectedIncidentForDetail.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('incidents.type')}:</span>
                  <span className="font-semibold text-slate-800">{renderTypeLabel(selectedIncidentForDetail.type, selectedIncidentForDetail.bilingualType)}</span>
                </div>
              </div>

              {selectedIncidentForDetail.punchTime && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900">
                  <strong>{t('incidents.missingPunch')}:</strong> {selectedIncidentForDetail.punchMovementType || 'Punch'} · {selectedIncidentForDetail.punchTime}
                </div>
              )}

              {selectedIncidentForDetail.minutes > 0 && (
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('incidents.excusedMinutes')}:</span>
                  <span className="font-semibold text-amber-700">{selectedIncidentForDetail.minutes} minutos</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block text-[11px]">{t('incidents.reason')}:</span>
                <p className="mt-1 p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                  {selectedIncidentForDetail.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('incidents.status')}:</span>
                  {getStatusBadge(selectedIncidentForDetail.status, selectedIncidentForDetail.bilingualStatus)}
                </div>
                {selectedIncidentForDetail.approvedBy && (
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{t('incidents.approvedBy')}: <strong>{selectedIncidentForDetail.approvedBy}</strong></div>
                    <div className="font-mono text-[10px]">{selectedIncidentForDetail.approvedAt}</div>
                  </div>
                )}
                {selectedIncidentForDetail.cancellationReason && (
                  <div className="text-right text-[11px] text-rose-600">
                    <div>{t('incidents.cancelledBy')}: <strong>{selectedIncidentForDetail.cancelledBy}</strong></div>
                    <div>Motivo: {selectedIncidentForDetail.cancellationReason}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedIncidentForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {selectedIncidentForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {t('incidents.ui_editar_incidencia_pendiente')}
              </h2>
              <button
                onClick={() => setSelectedIncidentForEdit(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                Empleado: <strong>{selectedIncidentForEdit.employeeName}</strong> ({selectedIncidentForEdit.employeeCode})
                <div className="text-slate-500">Fecha: {selectedIncidentForEdit.date}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('incidents.type')}</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="JustifiedLate">{t('incidents.justifiedLate')}</option>
                  <option value="PunchMiss">{t('incidents.punchMiss')}</option>
                  <option value="JustifiedAbsence">{t('incidents.justifiedAbsence')}</option>
                  <option value="Permission">{t('incidents.permission')}</option>
                  <option value="Vacation">{t('status.vacation')}</option>
                  <option value="Disability">{t('status.disability')}</option>
                  <option value="HomeOffice">{t('incidents.homeOffice')}</option>
                  <option value="FieldWork">{t('incidents.fieldWork')}</option>
                  <option value="ScheduleCorrection">{t('incidents.scheduleCorrection')}</option>
                </select>
              </div>

              {formType === 'PunchMiss' && (
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">{t('incidents.movement')}</label>
                    <select
                      value={formPunchMovementType}
                      onChange={(e) => setFormPunchMovementType(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="Entry">{t('common.entry')}</option>
                      <option value="MealExit">{t('incidents.mealExit')}</option>
                      <option value="MealReturn">{t('incidents.mealReturn')}</option>
                      <option value="Exit">{t('common.exit')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-indigo-900 mb-1">{t('common.time')}</label>
                    <input
                      type="time"
                      value={formPunchTime}
                      onChange={(e) => setFormPunchTime(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {(formType === 'JustifiedLate' || formType === 'Permission') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('incidents.minutesToJustify')}</label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={formMinutes}
                    onChange={(e) => setFormMinutes(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('incidents.reason')}</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIncidentForEdit(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL PROMPT MODAL */}
      {selectedIncidentForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <Ban className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">
                {t('incidents.ui_cancelar_incidencia')}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              ¿Está seguro de cancelar esta solicitud pendiente de <strong>{selectedIncidentForCancel.employeeName}</strong>?
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('incidents.ui_motivo_de_cancelacion')}
                </label>
                <input
                  type="text"
                  placeholder={t('incidents.cancelPlaceholder')}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedIncidentForCancel(null); setCancelReason(''); }}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
