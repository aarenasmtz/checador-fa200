import React from 'react';
import { Menu, Globe, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC<{ onMenuClick: () => void; compact?: boolean }> = ({ onMenuClick, compact = false }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();

  const toggleLanguage = () => {
    setLanguage(language === 'zh-CN' ? 'es-MX' : 'zh-CN');
  };

  return (
    <header className="h-16 corporate-header sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label={compact ? t('navigation.openMenu') : undefined}
          className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 lg:hidden transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-base sm:text-lg text-slate-800 tracking-tight">
            {compact ? t('navigation.company') : t('app.title')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">

        {/* Language Switcher */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F7F8] hover:bg-[#E6F2F0] text-[#203441] text-xs font-semibold border border-[#DFE7EB] transition shadow-2xs cursor-pointer min-h-[38px]"
        >
          <Globe className="w-3.5 h-3.5 text-[#00695F]" />
          <span>{language === 'zh-CN' ? '中文' : 'Español'}</span>
          <span className="text-[#DFE7EB]">|</span>
          <span className="text-[#00695F] font-bold">{language === 'zh-CN' ? 'ES' : '中'}</span>
        </button>

        {/* User indicator */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-[#DFE7EB]">
          <div className="w-8 h-8 rounded-full bg-[#00695F] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
            {user?.fullName?.charAt(0) || <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-bold text-[#203441] leading-tight">
              {user?.fullName || 'Admin'}
            </span>
            <span className="text-[10px] text-[#60727E] font-medium">
              {user?.roles?.[0] || 'SUPERADMIN'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
