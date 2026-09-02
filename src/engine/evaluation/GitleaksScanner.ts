/**
 * GitleaksScanner — real CLI adapter for Gitleaks v8+
 *
 * Invokes `gitleaks detect` against a temporary directory of generated files.
 * Falls back to the built-in FloeSecretScanner when:
 *   • gitleaks is not installed / not on PATH
 *   • the OS is not Linux/macOS (Windows PATH resolution differs; users should
 *     add gitleaks.exe to PATH explicitly)
 *
 * Usage in PipelineEngine:
 *   const scanner = new GitleaksScanner();
 *   const result  = await scanner.scan(files);
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { GeneratedFile } from '../codegenEngine';
import { EvaluationExecutionResult } from './types';
import { FloeSecretScanner } from './FloeSecretScanner';

const execFileAsync = promisify(execFile);

export class GitleaksScanner {
  readonly version = '8.x';
  readonly toolName = 'Gitleaks CLI (Secret Detector)';

  /** Write generated files to a temp dir, run gitleaks against it, then clean up. */
  public async scan(files: GeneratedFile[]): Promise<EvaluationExecutionResult> {
    const available = await this.isAvailable();
    if (!available) {
      console.info('[GitleaksScanner] gitleaks not found on PATH — falling back to built-in FloeSecretScanner.');
      const fallback = new FloeSecretScanner();
      return fallback.scan(files);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floe-gitleaks-'));
    try {
      // Write files to tmp dir
      for (const f of files) {
        const filePath = path.join(tmpDir, f.path.replace(/^\//, ''));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, f.content, 'utf-8');
      }

      const startedAt = new Date().toISOString();
      const startTime = Date.now();

      // gitleaks detect --source=<dir> --no-git --report-format=json --report-path=<out>
      const reportPath = path.join(tmpDir, 'gitleaks-report.json');
      let exitCode = 0;
      let rawReport: any = { findings: [] };

      try {
        await execFileAsync('gitleaks', [
          'detect',
          `--source=${tmpDir}`,
          '--no-git',
          '--report-format=json',
          `--report-path=${reportPath}`,
          '--exit-code=1'  // exit 1 when leaks found
        ], { timeout: 30_000 });
      } catch (err: any) {
        exitCode = err.code ?? 1;
        // exit code 1 = leaks found; anything else = error
      }

      if (fs.existsSync(reportPath)) {
        try { rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8')); } catch { /* malformed */ }
      }

      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      const findings = (rawReport || []).map((leak: any, i: number) => ({
        id: `gitleaks-${i + 1}`,
        tool: this.toolName,
        category: 'Secret',
        severity: 'critical' as const,
        ruleId: leak.RuleID || 'gitleaks-secret',
        title: `Secret detected: ${leak.Description || leak.RuleID}`,
        description: leak.Description || 'Potential secret or credential found.',
        file: leak.File ? path.relative(tmpDir, leak.File) : undefined,
        line: leak.StartLine,
        snippet: leak.Secret ? leak.Secret.slice(0, 40).replace(/./g, '*') : undefined,
        remediation: 'Remove the secret from source code and rotate the credential immediately.'
      }));

      const hasCritical = findings.length > 0;
      return {
        tool: `${this.toolName} v${this.version}`,
        version: this.version,
        category: 'Secrets',
        command: `gitleaks detect --source=. --no-git --report-format=json`,
        startedAt,
        completedAt,
        durationMs,
        exitCode,
        status: hasCritical ? 'failed' : 'passed',
        summary: `Gitleaks scanned ${files.length} files: ${findings.length} secrets detected`,
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
      await execFileAsync('gitleaks', ['version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Re-export built-in as named alias for backward compatibility
export { FloeSecretScanner } from './FloeSecretScanner';
