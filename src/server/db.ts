import { Pool } from 'pg';

export interface DbStatus {
  connected: boolean;
  database: string;
  host: string;
  user: string;
  port: number;
  ssl: boolean;
  latencyMs: number;
  tables: { name: string; rowCount: number }[];
  totalRecords: number;
  lastChecked: string;
  error?: string;
}

// SECURITY: There is intentionally NO hardcoded connection-string fallback
// here. A previous version of this file shipped a live database credential
// as a default value, which meant it was committed to source control and
// exposed to anyone with repo access. That credential must be treated as
// compromised and rotated in the Render dashboard. PostgreSQL persistence
// is an OPTIONAL layer in Floe -- every caller in this module already falls
// back to an in-memory store when the pool is unavailable -- so the correct
// behavior when DATABASE_URL is absent is to fail fast with a clear,
// non-secret error, not to silently connect to a hardcoded database.
const getDatabaseUrl = (): string | null => {
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return null;
};

/** Best-effort, non-throwing parse of DATABASE_URL for display/status purposes only. */
function parseConnectionDisplay(): { host: string; user: string; database: string; port: number } {
  const url = getDatabaseUrl();
  if (!url) {
    return { host: 'not configured', user: 'not configured', database: 'not configured', port: 5432 };
  }
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'unknown',
      user: decodeURIComponent(parsed.username || 'unknown'),
      database: (parsed.pathname || '').replace(/^\//, '') || 'unknown',
      port: parsed.port ? Number(parsed.port) : 5432
    };
  } catch {
    return { host: 'unknown', user: 'unknown', database: 'unknown', port: 5432 };
  }
}

let pool: Pool | null = null;
let isInitialized = false;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is not configured. PostgreSQL persistence is disabled; Floe will continue ' +
        'operating on its in-memory store. Set DATABASE_URL to enable durable persistence.'
      );
    }
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected client error:', err.message);
    });
  }
  return pool;
}

/**
 * Initialize PostgreSQL tables for Floe Enterprise Platform
 */
export async function initDatabase(): Promise<boolean> {
  if (isInitialized) return true;

  const client = getPool();
  try {
    console.log(`[PostgreSQL] Connecting to database at ${parseConnectionDisplay().host}...`);
    
    // Create necessary tables for full persistence
    await client.query(`
      -- Applications table
      CREATE TABLE IF NOT EXISTS applications (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(100) NOT NULL,
        ir_json JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Deployments table
      CREATE TABLE IF NOT EXISTS deployments (
        id VARCHAR(100) PRIMARY KEY,
        app_id VARCHAR(100) NOT NULL,
        app_name VARCHAR(255) NOT NULL,
        domain VARCHAR(100) NOT NULL,
        provider_id VARCHAR(50) NOT NULL,
        stage VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        service_url TEXT,
        health_endpoint TEXT,
        health_status VARCHAR(50),
        status_code INT,
        latency_ms INT,
        git_repo_url TEXT,
        git_commit_sha TEXT,
        is_free_tier BOOLEAN DEFAULT TRUE,
        resource_limits JSONB,
        expires_at TIMESTAMPTZ,
        error_message TEXT,
        logs JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Deployment event history
      CREATE TABLE IF NOT EXISTS deployment_events (
        id SERIAL PRIMARY KEY,
        deployment_id VARCHAR(100) REFERENCES deployments(id) ON DELETE CASCADE,
        stage VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );

      -- Test environments registration
      CREATE TABLE IF NOT EXISTS test_environments (
        id VARCHAR(100) PRIMARY KEY,
        domain VARCHAR(100) UNIQUE NOT NULL,
        db_name VARCHAR(100) NOT NULL,
        service_url TEXT NOT NULL,
        health_url TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Pipeline runs
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id VARCHAR(100) PRIMARY KEY,
        app_id VARCHAR(100) NOT NULL,
        app_name VARCHAR(255) NOT NULL,
        domain VARCHAR(100) NOT NULL,
        ir_version VARCHAR(50) DEFAULT '1.0.0',
        commit_sha VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        current_stage_id VARCHAR(50),
        policy_config JSONB,
        governance_decision JSONB,
        artifact JSONB,
        evidence_store JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Pipeline stages breakdown
      CREATE TABLE IF NOT EXISTS pipeline_stages (
        id SERIAL PRIMARY KEY,
        pipeline_id VARCHAR(100) REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        stage_id VARCHAR(50) NOT NULL,
        stage_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        summary TEXT,
        duration_ms INT,
        logs JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Evaluation results & audit artifacts
      CREATE TABLE IF NOT EXISTS evaluation_results (
        id VARCHAR(100) PRIMARY KEY,
        pipeline_id VARCHAR(100) NOT NULL,
        stage_id VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        hash VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Multi-tenant App records for generated domain entities
      CREATE TABLE IF NOT EXISTS app_records (
        id VARCHAR(100) PRIMARY KEY,
        domain VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        data JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'SUBMITTED',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Governance audit trail: immutable log of every gated tool call.
      -- No DELETE/TRUNCATE grants are issued against this table from the
      -- application layer; see src/engine/governance/hardFloors.ts
      -- 'floor.audit_trail_modify'.
      CREATE TABLE IF NOT EXISTS governance_audit_log (
        id VARCHAR(100) PRIMARY KEY,
        actor_id VARCHAR(100) NOT NULL,
        actor_name VARCHAR(255),
        actor_role VARCHAR(100),
        action_type VARCHAR(150) NOT NULL,
        summary TEXT,
        payload JSONB,
        app_id VARCHAR(100),
        domain VARCHAR(100),
        mode VARCHAR(20) NOT NULL,
        decision VARCHAR(30) NOT NULL,
        approval_source VARCHAR(30) NOT NULL,
        reviewer_verdict JSONB,
        reasoning TEXT,
        circuit_breaker_tripped BOOLEAN DEFAULT FALSE,
        decided_by VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Approval ladder: standing rules / allowlists per (actor, action).
      CREATE TABLE IF NOT EXISTS governance_ladder (
        actor_id VARCHAR(100) NOT NULL,
        action_type VARCHAR(150) NOT NULL,
        rung VARCHAR(30) NOT NULL,
        granted_by VARCHAR(100),
        granted_at TIMESTAMPTZ,
        reason TEXT,
        history JSONB DEFAULT '[]',
        PRIMARY KEY (actor_id, action_type)
      );

      -- Circuit breaker state per actor.
      CREATE TABLE IF NOT EXISTS governance_circuit_breaker (
        actor_id VARCHAR(100) PRIMARY KEY,
        consecutive_denials INT DEFAULT 0,
        tripped BOOLEAN DEFAULT FALSE,
        tripped_at TIMESTAMPTZ,
        reset_by VARCHAR(100),
        reset_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Persistent user credential store (backs authService.ts)
      -- password_hash stores the full scrypt:v1:<salt>:<hash> combined string.
      -- This is the canonical source of truth; the in-memory Map in authService
      -- is only a warm read-through cache seeded from this table at startup.
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'application_builder',
        role_title VARCHAR(255) NOT NULL DEFAULT 'Application Builder',
        organization VARCHAR(255) NOT NULL DEFAULT 'Floe Enterprise Workspace',
        permissions JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes for rapid querying
      CREATE INDEX IF NOT EXISTS idx_deployments_app_id ON deployments(app_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_domain ON deployments(domain);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_app_id ON pipeline_runs(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_records_domain_entity ON app_records(domain, entity);
      CREATE INDEX IF NOT EXISTS idx_governance_audit_actor ON governance_audit_log(actor_id);
      CREATE INDEX IF NOT EXISTS idx_governance_audit_action ON governance_audit_log(action_type);
      CREATE INDEX IF NOT EXISTS idx_governance_audit_created_at ON governance_audit_log(created_at);
    `);

    isInitialized = true;
    console.log('[PostgreSQL] ✓ Schema migration complete. 12 persistence tables ready on Render PostgreSQL.');
    return true;
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Failed to initialize database:', err.message);
    return false;
  }
}

/**
 * Get live Database Health & Status
 */
export async function getDbStatus(): Promise<DbStatus> {
  const start = Date.now();

  try {
    const pool = getPool();
    const res = await pool.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as version
    `);

    const latencyMs = Date.now() - start;
    const dbInfo = res.rows[0];

    // Check table counts
    const tablesRes = await pool.query(`
      SELECT 
        table_name,
        (xpath('/row/cnt/text()', xml_count))[1]::text::int as count
      FROM (
        SELECT 
          table_name, 
          query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      ) t
      ORDER BY table_name;
    `).catch(async () => {
      // Fallback query if XML functions restricted
      const tablesList = ['applications', 'deployments', 'deployment_events', 'test_environments', 'pipeline_runs', 'pipeline_stages', 'evaluation_results', 'app_records'];
      const counts: { table_name: string; count: number }[] = [];
      for (const t of tablesList) {
        try {
          const r = await pool.query(`SELECT count(*)::int as count FROM ${t}`);
          counts.push({ table_name: t, count: r.rows[0]?.count || 0 });
        } catch {
          counts.push({ table_name: t, count: 0 });
        }
      }
      return { rows: counts };
    });

    const tables = (tablesRes.rows || []).map((r: any) => ({
      name: r.table_name,
      rowCount: Number(r.count) || 0
    }));

    const totalRecords = tables.reduce((acc, t) => acc + t.rowCount, 0);

    return {
      connected: true,
      database: dbInfo?.database || parseConnectionDisplay().database,
      host: parseConnectionDisplay().host,
      user: dbInfo?.user || parseConnectionDisplay().user,
      port: Number(dbInfo?.server_port) || parseConnectionDisplay().port,
      ssl: true,
      latencyMs,
      tables,
      totalRecords,
      lastChecked: new Date().toISOString()
    };
  } catch (err: any) {
    const display = parseConnectionDisplay();
    return {
      connected: false,
      database: display.database,
      host: display.host,
      user: display.user,
      port: display.port,
      ssl: true,
      latencyMs: Date.now() - start,
      tables: [],
      totalRecords: 0,
      lastChecked: new Date().toISOString(),
      error: err.message
    };
  }
}

/**
 * Save deployment to PostgreSQL
 */
export async function saveDeploymentToDb(dep: any): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO deployments (
        id, app_id, app_name, domain, provider_id, stage, status,
        service_url, health_endpoint, health_status, status_code, latency_ms,
        git_repo_url, git_commit_sha, is_free_tier, resource_limits, expires_at,
        error_message, logs, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        stage = EXCLUDED.stage,
        status = EXCLUDED.status,
        service_url = EXCLUDED.service_url,
        health_endpoint = EXCLUDED.health_endpoint,
        health_status = EXCLUDED.health_status,
        status_code = EXCLUDED.status_code,
        latency_ms = EXCLUDED.latency_ms,
        error_message = EXCLUDED.error_message,
        logs = EXCLUDED.logs,
        updated_at = NOW()
      `,
      [
        dep.id,
        dep.appId || 'app-default',
        dep.appName || 'Business Application',
        dep.domain || 'app',
        dep.providerId || 'render',
        dep.stage || 'validating_ir',
        dep.status || 'building',
        dep.serviceUrl || '',
        dep.healthEndpoint || '',
        dep.healthStatus || 'checking',
        dep.statusCode || null,
        dep.latencyMs || null,
        dep.gitRepoUrl || '',
        dep.gitCommitSha || '',
        dep.isFreeTier !== false,
        JSON.stringify(dep.resourceLimits || {}),
        dep.expiresAt || null,
        dep.errorMessage || null,
        JSON.stringify(dep.logs || [])
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist deployment to DB:', err.message);
  }
}

/**
 * Get all deployments from PostgreSQL
 */
export async function getDeploymentsFromDb(): Promise<any[]> {
  try {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM deployments ORDER BY updated_at DESC LIMIT 50');
    return res.rows.map(r => ({
      id: r.id,
      appId: r.app_id,
      appName: r.app_name,
      domain: r.domain,
      providerId: r.provider_id,
      stage: r.stage,
      status: r.status,
      serviceUrl: r.service_url,
      healthEndpoint: r.health_endpoint,
      healthStatus: r.health_status,
      statusCode: r.status_code,
      latencyMs: r.latency_ms,
      gitRepoUrl: r.git_repo_url,
      gitCommitSha: r.git_commit_sha,
      isFreeTier: r.is_free_tier,
      resourceLimits: r.resource_limits,
      expiresAt: r.expires_at,
      errorMessage: r.error_message,
      logs: r.logs || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read deployments from DB:', err.message);
    return [];
  }
}

/**
 * Save pipeline run to PostgreSQL
 */
export async function savePipelineRunToDb(run: any): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO pipeline_runs (
        id, app_id, app_name, domain, ir_version, commit_sha, status,
        current_stage_id, policy_config, governance_decision, artifact, evidence_store, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        current_stage_id = EXCLUDED.current_stage_id,
        governance_decision = EXCLUDED.governance_decision,
        artifact = EXCLUDED.artifact,
        evidence_store = EXCLUDED.evidence_store,
        updated_at = NOW()
      `,
      [
        run.id,
        run.appId || 'app-default',
        run.appName || 'Business Application',
        run.domain || 'enterprise',
        run.irVersion || '1.0.0',
        run.commitSha || '',
        run.status || 'running',
        run.currentStageId || 'stage_1_spec',
        JSON.stringify(run.policyConfig || {}),
        JSON.stringify(run.governanceDecision || {}),
        JSON.stringify(run.artifact || {}),
        JSON.stringify(run.evidenceStore || {})
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist pipeline run to DB:', err.message);
  }
}

/**
 * Get pipeline runs from PostgreSQL
 */
export async function getPipelineRunsFromDb(): Promise<any[]> {
  try {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM pipeline_runs ORDER BY updated_at DESC LIMIT 50');
    return res.rows.map(r => ({
      id: r.id,
      appId: r.app_id,
      appName: r.app_name,
      domain: r.domain,
      irVersion: r.ir_version,
      commitSha: r.commit_sha,
      status: r.status,
      currentStageId: r.current_stage_id,
      policyConfig: r.policy_config,
      governanceDecision: r.governance_decision,
      artifact: r.artifact,
      evidenceStore: r.evidence_store,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read pipeline runs from DB:', err.message);
    return [];
  }
}

/**
 * Save app record to PostgreSQL
 */
export async function saveAppRecordToDb(domain: string, entity: string, record: any): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO app_records (id, domain, entity, data, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        status = EXCLUDED.status,
        updated_at = NOW()
      `,
      [
        record.id,
        domain.toLowerCase(),
        entity.toLowerCase(),
        JSON.stringify(record),
        record.status || 'SUBMITTED'
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist app record to DB:', err.message);
  }
}

/**
 * Save application metadata and IR to PostgreSQL
 */
export async function saveAppToDb(app: { id: string; name: string; domain: string; ir: any }): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO applications (id, name, domain, ir_json, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        domain = EXCLUDED.domain,
        ir_json = EXCLUDED.ir_json,
        updated_at = NOW()
      `,
      [
        app.id,
        app.name,
        app.domain.toLowerCase(),
        JSON.stringify(app.ir)
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist application to DB:', err.message);
  }
}

/**
 * Get application by domain or ID from PostgreSQL
 */
export async function getAppFromDb(domainOrId: string): Promise<any | null> {
  try {
    const pool = getPool();
    const res = await pool.query(
      'SELECT * FROM applications WHERE id = $1 OR LOWER(domain) = $2 LIMIT 1',
      [domainOrId, domainOrId.toLowerCase()]
    );
    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        domain: r.domain,
        ir: r.ir_json,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    }
    return null;
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read application from DB:', err.message);
    return null;
  }
}

/**
 * Get all applications from PostgreSQL
 */
export async function getAllAppsFromDb(): Promise<any[]> {
  try {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM applications ORDER BY updated_at DESC LIMIT 50');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      ir: r.ir_json,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read applications from DB:', err.message);
    return [];
  }
}

/**
 * Delete application from PostgreSQL
 */
export async function deleteAppFromDb(domainOrId: string): Promise<boolean> {
  try {
    const pool = getPool();
    await pool.query(
      'DELETE FROM applications WHERE id = $1 OR LOWER(domain) = $2',
      [domainOrId, domainOrId.toLowerCase()]
    );
    return true;
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not delete application from DB:', err.message);
    return false;
  }
}

/**
 * Get app records from PostgreSQL
 */
export async function getAppRecordsFromDb(domain: string, entity: string): Promise<any[]> {
  try {
    const pool = getPool();
    const res = await pool.query(
      'SELECT data FROM app_records WHERE domain = $1 AND entity = $2 ORDER BY created_at ASC',
      [domain.toLowerCase(), entity.toLowerCase()]
    );
    return res.rows.map(r => r.data);
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read app records from DB:', err.message);
    return [];
  }
}

// ============================================================================
// GOVERNANCE PERSISTENCE
// ----------------------------------------------------------------------------
// Mirrors src/engine/governance/GovernanceEngine.ts in-memory state to
// Postgres. There is intentionally NO deleteGovernanceAuditEntry /
// truncateGovernanceAuditLog export — see hardFloors.ts 'floor.audit_trail_modify'.
// ============================================================================

/** Persist a single immutable governance audit entry. Append-only. */
export async function saveGovernanceAuditEntry(entry: any): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO governance_audit_log (
        id, actor_id, actor_name, actor_role, action_type, summary, payload,
        app_id, domain, mode, decision, approval_source, reviewer_verdict,
        reasoning, circuit_breaker_tripped, decided_by, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17
      )
      ON CONFLICT (id) DO NOTHING
      `,
      [
        entry.id,
        entry.toolCall.actor.id,
        entry.toolCall.actor.name || '',
        entry.toolCall.actor.role || '',
        entry.toolCall.actionType,
        entry.toolCall.summary || '',
        JSON.stringify(entry.toolCall.payload || {}),
        entry.toolCall.context?.appId || null,
        entry.toolCall.context?.domain || null,
        entry.toolCall.mode,
        entry.decision,
        entry.approvalSource,
        JSON.stringify(entry.reviewerVerdict || null),
        entry.reasoning || '',
        !!entry.circuitBreakerTripped,
        entry.decidedBy || null,
        entry.timestamp
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist governance audit entry to DB:', err.message);
  }
}

/** Read governance audit entries, most recent first. */
export async function getGovernanceAuditLogFromDb(filter?: { actorId?: string; appId?: string; limit?: number }): Promise<any[]> {
  try {
    const pool = getPool();
    const clauses: string[] = [];
    const params: any[] = [];
    if (filter?.actorId) {
      params.push(filter.actorId);
      clauses.push(`actor_id = $${params.length}`);
    }
    if (filter?.appId) {
      params.push(filter.appId);
      clauses.push(`app_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(filter?.limit || 100, 500);
    const res = await pool.query(
      `SELECT * FROM governance_audit_log ${where} ORDER BY created_at DESC LIMIT ${limit}`,
      params
    );
    return res.rows.map(r => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      actionType: r.action_type,
      summary: r.summary,
      payload: r.payload,
      appId: r.app_id,
      domain: r.domain,
      mode: r.mode,
      decision: r.decision,
      approvalSource: r.approval_source,
      reviewerVerdict: r.reviewer_verdict,
      reasoning: r.reasoning,
      circuitBreakerTripped: r.circuit_breaker_tripped,
      decidedBy: r.decided_by,
      createdAt: r.created_at
    }));
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read governance audit log from DB:', err.message);
    return [];
  }
}

/** Upsert an approval-ladder entry (standing_rule / allowlisted / none). */
export async function saveGovernanceLadderEntryToDb(entry: any): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO governance_ladder (actor_id, action_type, rung, granted_by, granted_at, reason, history)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (actor_id, action_type) DO UPDATE SET
        rung = EXCLUDED.rung,
        granted_by = EXCLUDED.granted_by,
        granted_at = EXCLUDED.granted_at,
        reason = EXCLUDED.reason,
        history = EXCLUDED.history
      `,
      [
        entry.actorId,
        entry.actionType,
        entry.rung,
        entry.grantedBy || null,
        entry.grantedAt || null,
        entry.reason || null,
        JSON.stringify(entry.history || [])
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist governance ladder entry to DB:', err.message);
  }
}

/** Read all approval-ladder entries. */
export async function getGovernanceLadderFromDb(): Promise<any[]> {
  try {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM governance_ladder');
    return res.rows.map(r => ({
      actorId: r.actor_id,
      actionType: r.action_type,
      rung: r.rung,
      grantedBy: r.granted_by,
      grantedAt: r.granted_at,
      reason: r.reason,
      history: r.history || []
    }));
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not read governance ladder from DB:', err.message);
    return [];
  }
}

/** Upsert circuit breaker state for an actor. */
export async function saveGovernanceCircuitBreakerToDb(state: any): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO governance_circuit_breaker (actor_id, consecutive_denials, tripped, tripped_at, reset_by, reset_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (actor_id) DO UPDATE SET
        consecutive_denials = EXCLUDED.consecutive_denials,
        tripped = EXCLUDED.tripped,
        tripped_at = EXCLUDED.tripped_at,
        reset_by = EXCLUDED.reset_by,
        reset_at = EXCLUDED.reset_at,
        updated_at = NOW()
      `,
      [
        state.actorId,
        state.consecutiveDenials,
        state.tripped,
        state.trippedAt || null,
        state.resetBy || null,
        state.resetAt || null
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist governance circuit breaker state to DB:', err.message);
  }
}

// ============================================================================
// USER CREDENTIAL PERSISTENCE
// ----------------------------------------------------------------------------
// These functions back authService.ts, giving user registrations durability
// across server restarts. The in-memory Map in authService is a warm cache;
// these functions are the canonical source of truth.
// ============================================================================

/**
 * Upsert a user credential record. Safe to call on every registration or
 * password change — uses ON CONFLICT to update in place.
 */
export async function saveUserToDb(user: {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: string;
  roleTitle: string;
  organization: string;
  permissions: string[];
}): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO users (id, email, password_hash, salt, name, role, role_title, organization, permissions, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (email) DO UPDATE SET
        id             = EXCLUDED.id,
        password_hash  = EXCLUDED.password_hash,
        salt           = EXCLUDED.salt,
        name           = EXCLUDED.name,
        role           = EXCLUDED.role,
        role_title     = EXCLUDED.role_title,
        organization   = EXCLUDED.organization,
        permissions    = EXCLUDED.permissions,
        updated_at     = NOW()
      `,
      [
        user.id,
        user.email.toLowerCase(),
        user.passwordHash,
        user.salt,
        user.name,
        user.role,
        user.roleTitle,
        user.organization,
        JSON.stringify(user.permissions || [])
      ]
    );
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not persist user credential to DB:', err.message);
  }
}

/**
 * Load all user credentials from PostgreSQL into memory.
 * Called once at server startup to warm the in-memory cache.
 */
export async function loadUsersFromDb(): Promise<Array<{
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: string;
  roleTitle: string;
  organization: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}>> {
  try {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(r => ({
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      salt: r.salt,
      name: r.name,
      role: r.role,
      roleTitle: r.role_title,
      organization: r.organization,
      permissions: Array.isArray(r.permissions) ? r.permissions : JSON.parse(r.permissions || '[]'),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not load users from DB:', err.message);
    return [];
  }
}
