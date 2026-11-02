import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import '../styles/clear-cards.css';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAttendance = useLocation().pathname === '/attendance';

  return (
    <div className={`min-h-screen bg-[#f8fafc] flex ${isAttendance ? '' : 'wpc-design wpc-shell'}`}>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} compact={!isAttendance} />

      {/* Main content wrapper */}
      <div className={`flex-1 min-w-0 w-full max-w-full lg:pl-64 flex flex-col min-h-screen ${isAttendance ? '' : 'wpc-content'}`}>
        <Header onMenuClick={() => setSidebarOpen(true)} compact={!isAttendance} />
        <main className={`flex-1 min-w-0 w-full max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 ${isAttendance ? '' : 'wpc-page'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
