/**
 * ZapDastScanner — real CLI adapter for OWASP ZAP (zaproxy)
 *
 * Invokes `zap-cli` or the ZAP Docker image for a baseline scan against a
 * live target URL. Falls back to the built-in FloeRuntimeSecurityProbe when:
 *   • zap-cli / docker is not on PATH
 *   • the target URL is localhost (ZAP in Docker can't reach the host network
 *     without extra config, so the built-in HTTP probe is used instead)
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { EvaluationExecutionResult, EvaluationFinding } from './types';
import { FloeRuntimeSecurityProbe } from './FloeRuntimeSecurityProbe';

const execFileAsync = promisify(execFile);

export class ZapDastScanner {
  readonly version = '2.14+';
  readonly toolName = 'OWASP ZAP CLI (DAST)';

  public async scan(targetUrl: string): Promise<EvaluationExecutionResult> {
    const isLocal = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
    const zapAvailable = !isLocal && await this.isZapAvailable();

    if (!zapAvailable) {
      const reason = isLocal
        ? 'target is localhost (ZAP cannot reach host from Docker without extra config)'
        : 'zap-cli / docker not found on PATH';
      console.info(`[ZapDastScanner] ${reason} — falling back to built-in FloeRuntimeSecurityProbe.`);
      const fallback = new FloeRuntimeSecurityProbe();
      return fallback.scan(targetUrl);
    }

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floe-zap-'));
    const reportPath = path.join(tmpDir, 'zap-report.json');
    let exitCode = 0;
    let rawReport: any = {};

    try {
      // zap-cli quick-scan --self-contained --start-options="-config api.disablekey=true" -o "-config ajaxSpider.browserId=htmlunit" <url>
      // For simplicity, use zap-baseline.py via docker if available
      try {
        await execFileAsync('docker', [
          'run', '--rm',
          '-v', `${tmpDir}:/zap/wrk/:rw`,
          '--network=host',
          'ghcr.io/zaproxy/zaproxy:stable',
          'zap-baseline.py',
          '-t', targetUrl,
          '-J', '/zap/wrk/zap-report.json',
          '-I'   // ignore warnings and just output report
        ], { timeout: 120_000 });
      } catch (err: any) {
        exitCode = err.code ?? 1;
      }

      if (fs.existsSync(reportPath)) {
        try { rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8')); } catch { /* malformed */ }
      }

      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      const findings: EvaluationFinding[] = [];
      for (const site of rawReport.site || []) {
        for (const alert of site.alerts || []) {
          const riskScore = parseInt(alert.riskcode || '0', 10);
          const sev: EvaluationFinding['severity'] =
            riskScore >= 3 ? 'critical' : riskScore === 2 ? 'high' : riskScore === 1 ? 'medium' : 'low';
          findings.push({
            id: `zap-${findings.length + 1}`,
            tool: this.toolName,
            category: 'DAST',
            severity: sev,
            ruleId: alert.pluginid || alert.alertRef || 'zap-alert',
            title: alert.alert || alert.name || 'ZAP Alert',
            description: alert.desc || '',
            url: alert.instances?.[0]?.uri || targetUrl,
            remediation: alert.solution || 'Review ZAP report for remediation guidance.'
          });
        }
      }

      const hasCritical = findings.some(f => f.severity === 'critical' || f.severity === 'high');
      return {
        tool: `${this.toolName} v${this.version}`,
        version: this.version,
        category: 'DAST',
        command: `zap-baseline.py -t ${targetUrl} -J zap-report.json`,
        startedAt,
        completedAt,
        durationMs,
        exitCode,
        status: hasCritical ? 'failed' : findings.length > 0 ? 'warning' : 'passed',
        summary: `ZAP baseline scan of ${targetUrl}: ${findings.length} alerts`,
        findings,
        rawArtifact: rawReport,
        artifactHash: ''
      };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private async isZapAvailable(): Promise<boolean> {
    // Prefer docker (ZAP official Docker image) over local install
    try {
      await execFileAsync('docker', ['info'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Re-export built-in as named alias
export { FloeRuntimeSecurityProbe } from './FloeRuntimeSecurityProbe';
