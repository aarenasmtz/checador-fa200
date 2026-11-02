// Local-only UI fault/empty-state harness. It is not imported by the application or production build.
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(base, defineConfig({
  server: { host: '0.0.0.0', port: 5175, strictPort: true },
  plugins: [{
    name: 'checador-readonly-ui-qa',
    configureServer(server) {
      let scenario = 'real';
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || '/', 'http://localhost');
        const requested = url.searchParams.get('qaState');
        if (requested && ['real', 'error', 'empty'].includes(requested)) scenario = requested;
        if (!url.pathname.startsWith('/api/')) return next();
        // Only login and read requests can reach the existing API from this test server.
        if (request.method !== 'GET' && url.pathname !== '/api/v1/auth/login') {
          response.writeHead(405, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ message: 'Read-only QA server: writes are disabled.' }));
          return;
        }
        if (url.pathname.includes('/auth/')) return next();
        if (scenario === 'real') return next();
        response.setHeader('Content-Type', 'application/json');
        if (scenario === 'error') { response.statusCode = 503; response.end('{}'); return; }
        const paged = /\/(employees|attendance|incidents|audit|users)$/.test(url.pathname);
        const payload = url.pathname.endsWith('/reports/attendance')
          ? { data: [], totalRecords: 0, totalEmployees: 0, totalConfirmedMinutes: 0, totalLateMinutes: 0, pendingReviewCount: 0 }
          : url.pathname.endsWith('/dashboard/summary')
            ? { metrics: {}, trend: [], branches: [], recentActivity: [] }
            : url.pathname.endsWith('/dashboard/day-detail')
              ? { records: [], summary: {} }
              : paged ? { items: [], totalPages: 1, totalRecords: 0 } : [];
        response.end(JSON.stringify(payload));
      });
    },
  }],
}));
