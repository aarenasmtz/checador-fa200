import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const useCatalogView = (module: string, fallback: 'grid' | 'table' = 'grid') => {
  const { user } = useAuth();
  const key = `${module}_view_mode:user:${user?.id ?? 'session'}`;
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    const saved = localStorage.getItem(key) || localStorage.getItem(`${module}_view_mode`);
    return saved === 'grid' || saved === 'table' ? saved : fallback;
  });
  const handleSetViewMode = (value: 'grid' | 'table') => {
    setViewMode(value);
    localStorage.setItem(key, value);
  };
  return { viewMode, handleSetViewMode };
};
