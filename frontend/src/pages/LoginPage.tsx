import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Lock, User, Globe, AlertCircle, Eye, EyeOff, Clock } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const success = await login(username, password);
    if (success) {
      navigate('/');
    } else {
      setError(language === 'zh-CN' ? '用户名或密码错误，请重试' : 'Usuario o contraseña incorrectos');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100 flex flex-col justify-center items-center p-4 relative">
      {/* Top right language switcher */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setLanguage(language === 'zh-CN' ? 'es-MX' : 'zh-CN')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-xs font-semibold text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-50 transition cursor-pointer"
        >
          <Globe className="w-4 h-4 text-indigo-600" />
          <span>{language === 'zh-CN' ? '切换至 Español' : '切换至 简体中文'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl border border-slate-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 mb-4">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">华龙商业集团</h1>
          <p className="text-xs text-slate-500 mt-1">Grupo Comercial David Guan · 考勤控制中心</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('auth.username')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={language === 'zh-CN' ? '请输入用户名' : 'Ingresa tu usuario'}
                required
                autoComplete="username"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'zh-CN' ? '请输入密码' : 'Ingresa tu contraseña'}
                required
                autoComplete="current-password"
                className="w-full pl-9 pr-11 py-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none rounded transition cursor-pointer"
                tabIndex={-1}
                title={showPassword ? (language === 'zh-CN' ? '隐藏密码' : 'Ocultar contraseña') : (language === 'zh-CN' ? '显示密码' : 'Ver contraseña')}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg text-sm transition shadow-md shadow-indigo-200 disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common.loading') : t('auth.submit')}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
          <span>华龙商业集团 · Grupo Comercial David Guan &copy; 2026</span>
        </div>
      </div>
    </div>
  );
};
