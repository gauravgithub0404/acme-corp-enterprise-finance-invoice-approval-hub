/**
 * SyftSbomEngine — real CLI adapter for Anchore Syft v0.105+
 *
 * Invokes `syft` against a temp directory to produce a CycloneDX 1.5 JSON SBOM.
 * Falls back to the built-in FloeSbomGenerator when Syft is not installed.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { GeneratedFile } from '../codegenEngine';
import { EvaluationExecutionResult } from './types';
import { SbomReport } from '../../types/pipeline';
import { FloeSbomGenerator } from './FloeSbomGenerator';

const execFileAsync = promisify(execFile);

export class SyftSbomEngine {
  readonly version = '0.105+';
  readonly toolName = 'Anchore Syft CLI (SBOM Generator)';

  public async generate(files: GeneratedFile[], domain: string): Promise<{ result: EvaluationExecutionResult; sbom: SbomReport }> {
    const available = await this.isAvailable();
    if (!available) {
      console.info('[SyftSbomEngine] syft not found on PATH — falling back to built-in FloeSbomGenerator.');
      const fallback = new FloeSbomGenerator();
      return fallback.generate(files, domain);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floe-syft-'));
    try {
      for (const f of files) {
        const filePath = path.join(tmpDir, f.path.replace(/^\//, ''));
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, f.content, 'utf-8');
      }

      const startedAt = new Date().toISOString();
      const startTime = Date.now();
      const reportPath = path.join(tmpDir, 'syft-sbom.json');
      let exitCode = 0;
      let rawReport: any = {};

      try {
        await execFileAsync('syft', [
          `dir:${tmpDir}`,
          '--output=cyclonedx-json',
          `--file=${reportPath}`,
          '--quiet'
        ], { timeout: 60_000 });
      } catch (err: any) {
        exitCode = err.code ?? 1;
      }

      if (fs.existsSync(reportPath)) {
        try { rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8')); } catch { /* malformed */ }
      }

      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      const components = (rawReport.components || []).map((c: any) => ({
        name: c.name,
        version: c.version || 'unknown',
        type: c.type || 'library',
        purl: c.purl || '',
        license: c.licenses?.[0]?.expression || c.licenses?.[0]?.license?.id || 'UNKNOWN',
        vulnerabilitiesCount: 0
      }));

      const sbom: SbomReport = {
        bomFormat: 'CycloneDX',
        specVersion: rawReport.specVersion || '1.5',
        serialNumber: rawReport.serialNumber || `urn:uuid:syft-${Date.now()}`,
        timestamp: completedAt,
        totalDependencies: components.length,
        totalDirect: components.length,
        licensesFound: [...new Set<string>(components.map((c: any) => c.license as string))],
        components,
        sbomSha256: ''
      };

      const executionResult: EvaluationExecutionResult = {
        tool: `${this.toolName} v${this.version}`,
        version: this.version,
        category: 'SBOM',
        command: `syft dir:${tmpDir} --output=cyclonedx-json`,
        startedAt,
        completedAt,
        durationMs,
        exitCode,
        status: exitCode === 0 ? 'passed' : 'warning',
        summary: `Syft generated CycloneDX 1.5 SBOM: ${components.length} components`,
        findings: [],
        rawArtifact: rawReport,
        artifactHash: ''
      };

      return { result: executionResult, sbom };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('syft', ['version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Re-export built-in as named alias
export { FloeSbomGenerator } from './FloeSbomGenerator';
