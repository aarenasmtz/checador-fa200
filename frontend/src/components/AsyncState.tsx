import React from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface StateProps {
  className?: string;
}

interface ErrorStateProps extends StateProps {
  message?: string | null;
  onRetry: () => void;
}

interface EmptyStateProps extends StateProps {
  title?: string;
  description?: string;
}

export const LoadingState: React.FC<StateProps> = ({ className = '' }) => {
  const { t } = useLanguage();

  return (
    <div className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-xs ${className}`} role="status">
      <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" aria-hidden="true" />
      <span className="text-sm font-medium">{t('common.loading')}</span>
    </div>
  );
};

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className = '' }) => {
  const { t } = useLanguage();

  return (
    <div className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-8 text-center ${className}`} role="alert">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-rose-600 shadow-xs">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-bold text-rose-900">{t('common.loadErrorTitle')}</p>
        <p className="mt-1 max-w-xl text-xs text-rose-700">{message || t('common.loadErrorDescription')}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t('common.retry')}
      </button>
    </div>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, className = '' }) => {
  const { t } = useLanguage();

  return (
    <div className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-bold text-slate-800">{title || t('common.emptyTitle')}</p>
        <p className="mt-1 max-w-xl text-xs text-slate-500">{description || t('common.emptyDescription')}</p>
      </div>
    </div>
  );
};
