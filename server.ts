import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initDatabase, saveGovernanceAuditEntry } from './src/server/db';
import { hydrateAuthStoreFromDb } from './src/server/authService';
import { loadAiConfigFromDb } from './src/server/aiService';
import { governanceEngine } from './src/engine/governance/GovernanceEngine';
import { createRateLimiter } from './src/server/rateLimit';

// Routers
import authRouter from './src/server/routes/auth';
import appsRouter from './src/server/routes/apps';
import renderRouter from './src/server/routes/render';
import deploymentsRouter, { testbedRouter } from './src/server/routes/deployments';
import pipelineRouter from './src/server/routes/pipeline';
import governanceRouter from './src/server/routes/governance';
import aiAdminRouter from './src/server/routes/ai';
import githubRouter from './src/server/routes/github';

// =============================================================================
// PRODUCTION HARD FLOOR — session secret check (moved to session.ts; the
// import of session.ts via the routers already triggers the check at boot).
// =============================================================================

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  // ---------------------------------------------------------------------------
  // CORS
  // In production, restrict Access-Control-Allow-Origin to the configured
  // APP_URL (e.g. https://my-app.onrender.com). In development and when
  // APP_URL is not set, fall back to '*' so the Vite dev server and the
  // shareable testbed links keep working.
  //
  // Public read-only surfaces (health, testbed record API) intentionally
  // remain open regardless of mode — they match the product's "share a
  // testbed link with anyone" design.
  //
  // Mutating or governance-sensitive routes are additionally protected by
  // requireStudioSession, so an overly-broad CORS origin would only allow
  // un-authenticated requests to reach those guards (where they get 401).
  // ---------------------------------------------------------------------------
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigin = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : null;

  // Paths that are intentionally open to any origin (testbed, public health)
  const openPaths = ['/api/health', '/api/testbed/', '/api/deployed-app', '/api/app-info'];

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin || '';
    const isOpenPath = openPaths.some(p => req.path.startsWith(p));

    let allowedOrigin: string;
    if (!isProduction || isOpenPath || !configuredOrigin) {
      // Development or intentionally-open routes: allow all origins
      allowedOrigin = '*';
    } else {
      // Production restricted routes: only the configured APP_URL origin
      allowedOrigin = requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin;
    }

    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (allowedOrigin !== '*') {
      res.header('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Global rate limiter — 150 req / 60 s per IP across all /api/* routes
  const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 150,
    message: 'Too many requests from this client. Please retry in 60 seconds.'
  });
  app.use('/api/', apiRateLimiter);

  // ---------------------------------------------------------------------------
  // Startup: DB schema, user hydration, AI config hydration, governance wiring
  // ---------------------------------------------------------------------------
  initDatabase().then(async success => {
    if (success) {
      console.log('[Floe Orchestrator] ✓ Connected to Render PostgreSQL cluster');
      // Hydrate user credentials from DB so registrations survive restarts
      await hydrateAuthStoreFromDb().catch(err => console.warn('[Floe Orchestrator] Auth hydration warning:', err.message));
      // Hydrate AI config from DB so admin-configured keys survive restarts
      await loadAiConfigFromDb().catch(err => console.warn('[Floe Orchestrator] AI config hydration warning:', err.message));
    }
  }).catch(err => console.warn('[Floe Orchestrator] PostgreSQL init warning:', err.message));

  // Mirror every governance audit decision to Postgres (append-only)
  governanceEngine.auditTrail.setPersistHandler(entry => {
    saveGovernanceAuditEntry(entry).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // Mount routers
  // ---------------------------------------------------------------------------
  app.use('/api/auth', authRouter);
  app.use('/api', appsRouter);           // mounts /api/app-info, /api/apps, /api/health, etc.
  app.use('/api/render', renderRouter);
  app.use('/api/deployments', deploymentsRouter);
  app.use('/api/testbed', testbedRouter);
  app.use('/api/pipeline', pipelineRouter);
  app.use('/api/governance', governanceRouter);
  app.use('/api/admin', aiAdminRouter);   // /api/admin/ai-config, /api/admin/ai-test
  app.use('/api/ai', aiAdminRouter);      // /api/ai/generate
  app.use('/api/github', githubRouter);

  // ---------------------------------------------------------------------------
  // Vite dev middleware / production static serving
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        }
        next();
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const distIndex = path.join(distPath, 'index.html');
      if (fs.existsSync(distIndex)) return res.sendFile(distIndex);
      return res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Floe Platform server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Floe Platform] Fatal error during server initialization:', err);
});
