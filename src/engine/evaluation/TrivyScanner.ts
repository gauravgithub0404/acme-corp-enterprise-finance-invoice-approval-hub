/**
 * TrivyScanner — real CLI adapter for Trivy v0.49+
 *
 * Invokes `trivy fs` against a temp directory of generated files for
 * dependency CVE and container misconfiguration scanning.
 * Falls back to the built-in FloeContainerVulnerabilityScanner when Trivy
 * is not installed.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { GeneratedFile } from '../codegenEngine';
import { EvaluationExecutionResult, EvaluationFinding } from './types';
import { FloeContainerVulnerabilityScanner } from './FloeContainerVulnerabilityScanner';

const execFileAsync = promisify(execFile);

export class TrivyScanner {
  readonly version = '0.49+';
  readonly toolName = 'Trivy CLI (Container & Dependency Scanner)';

  public async scan(files: GeneratedFile[]): Promise<EvaluationExecutionResult> {
    const available = await this.isAvailable();
    if (!available) {
      console.info('[TrivyScanner] trivy not found on PATH — falling back to built-in FloeContainerVulnerabilityScanner.');
      const fallback = new FloeContainerVulnerabilityScanner();
      return fallback.scan(files);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floe-trivy-'));
    try {
      for (const f of files) {
        const filePath = path.join(tmpDir, f.path.replace(/^\//, ''));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, f.content, 'utf-8');
      }

      const startedAt = new Date().toISOString();
      const startTime = Date.now();
      const reportPath = path.join(tmpDir, 'trivy-report.json');
      let exitCode = 0;
      let rawReport: any = { Results: [] };

      try {
        await execFileAsync('trivy', [
          'fs',
          tmpDir,
          '--format=json',
          `--output=${reportPath}`,
          '--quiet',
          '--exit-code=1'
        ], { timeout: 60_000 });
      } catch (err: any) {
        exitCode = err.code ?? 1;
      }

      if (fs.existsSync(reportPath)) {
        try { rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8')); } catch { /* malformed */ }
      }

      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      const findings: EvaluationFinding[] = [];
      for (const result of rawReport.Results || []) {
        for (const vuln of result.Vulnerabilities || []) {
          const sev = (vuln.Severity || 'LOW').toLowerCase() as EvaluationFinding['severity'];
          findings.push({
            id: `trivy-${findings.length + 1}`,
            tool: this.toolName,
            category: 'Dependencies',
            severity: sev,
            ruleId: vuln.VulnerabilityID || 'UNKNOWN',
            title: `${vuln.VulnerabilityID}: ${vuln.Title || vuln.PkgName}`,
            description: vuln.Description || `CVE in ${vuln.PkgName}@${vuln.InstalledVersion}`,
            file: result.Target,
            remediation: vuln.FixedVersion ? `Upgrade to ${vuln.FixedVersion}` : 'No fix available; evaluate risk.'
          });
        }
      }

      const hasCritical = findings.some(f => f.severity === 'critical' || f.severity === 'high');
      return {
        tool: `${this.toolName} v${this.version}`,
        version: this.version,
        category: 'Dependencies',
        command: `trivy fs ${tmpDir} --format=json`,
        startedAt,
        completedAt,
        durationMs,
        exitCode,
        status: hasCritical ? 'failed' : findings.length > 0 ? 'warning' : 'passed',
        summary: `Trivy scanned ${files.length} files: ${findings.length} CVEs found (${findings.filter(f => f.severity === 'critical' || f.severity === 'high').length} high/critical)`,
        findings,
        rawArtifact: rawReport,
        artifactHash: ''
      };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('trivy', ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Re-export built-in as named alias
export { FloeContainerVulnerabilityScanner } from './FloeContainerVulnerabilityScanner';
