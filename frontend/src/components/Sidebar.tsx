import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Building2,
  Cpu,
  Sliders,
  CalendarClock,
  AlertTriangle,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
  LogOut,
  Radio,
  History,
  Clock
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void; compact?: boolean }> = ({ isOpen, onClose, compact = false }) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const privileged = user?.roles?.some(role => ['SUPERADMIN', 'ADMIN'].includes(role));
  const permissions: Record<string, string> = { '/attendance': 'attendance.view', '/devices': 'devices.view', '/employees': 'employees.view', '/branches': 'employees.view', '/schedules': 'attendance.view', '/incidents': 'incidents.manage', '/reports': 'reports.view', '/users': 'users.manage', '/settings': 'devices.view', '/audit': 'attendance.view' };

  const menuItems = [
    { to: '/', label: t('menu.home'), icon: LayoutDashboard },
    { to: '/attendance', label: t('menu.attendance'), icon: CalendarCheck },
    { to: '/devices', label: t('menu.devices'), icon: Cpu },
    { to: '/employees', label: t('menu.employees'), icon: Users },
    { to: '/branches', label: t('menu.branches'), icon: Building2 },
    { to: '/schedules', label: t('menu.schedules'), icon: CalendarClock },
    { to: '/incidents', label: t('menu.incidents'), icon: AlertTriangle },
    { to: '/reports', label: t('menu.reports'), icon: FileSpreadsheet },
    { to: '/audit', label: t('menu.audit'), icon: History },
    { to: '/users', label: t('menu.users'), icon: ShieldCheck },
    { to: '/settings', label: t('menu.settings'), icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 corporate-sidebar flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[#DFE7EB] gap-3 bg-white">
          <div className="w-9 h-9 rounded-xl bg-[#00695F] flex items-center justify-center text-white shadow-sm text-sm shrink-0">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-sm tracking-tight text-[#203441] truncate">{compact ? t('navigation.company') : '华龙商业集团'}</span>
            <span className="text-[11px] text-[#00695F] font-semibold truncate">{compact ? 'CHECADOR WPC' : 'Grupo David Guan'}</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 bg-white">
          {menuItems.filter(item => !compact || !permissions[item.to] || privileged || user?.permissions?.includes(permissions[item.to])).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#E6F2F0] text-[#00695F] font-bold border-l-3 border-[#00695F] shadow-2xs'
                      : 'text-[#60727E] hover:text-[#203441] hover:bg-[#F4F7F8]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User badge & Logout */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 truncate">{user?.fullName || 'Admin'}</span>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase">{user?.roles?.[0] || 'SUPERADMIN'}</span>
            </div>
            <button
              onClick={logout}
              title={t('auth.logout')}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
