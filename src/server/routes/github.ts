import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import { listRenderServices, triggerRenderDeploy } from '../renderApi';

const router = Router();

// GET /api/github/user
router.get('/user', async (req, res) => {
  try {
    const token = (req.query.token as string) || process.env.GITHUB_TOKEN || '';
    if (!token) return res.status(200).json({ authenticated: false, error: 'No GitHub token provided' });

    const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Floe-Studio-App', 'Authorization': `Bearer ${token}` };
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) return res.status(200).json({ authenticated: false, error: `GitHub API error: ${userRes.statusText}` });

    const userData = await userRes.json();
    let orgs: any[] = [];
    try {
      const orgsRes = await fetch('https://api.github.com/user/orgs', { headers });
      if (orgsRes.ok) orgs = await orgsRes.json();
    } catch { /* swallow */ }

    res.status(200).json({ authenticated: true, login: userData.login, name: userData.name || userData.login, avatar_url: userData.avatar_url, html_url: userData.html_url, orgs: orgs.map((o: any) => ({ login: o.login, avatar_url: o.avatar_url, description: o.description })) });
  } catch (err: any) {
    res.status(200).json({ authenticated: false, error: err.message });
  }
});

// GET /api/github/status
router.get('/status', async (req, res) => {
  try {
    const repo = (req.query.repo as string) || '';
    const branch = (req.query.branch as string) || 'main';
    const token = (req.query.token as string) || process.env.GITHUB_TOKEN || '';
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Floe-Studio-App' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!repoRes.ok) return res.status(200).json({ connected: false, exists: false, repo, branch, hasPat: Boolean(token), error: `Repository ${repo} not found (${repoRes.status})` });

    const repoInfo = await repoRes.json();
    const response = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, { headers, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return res.status(200).json({ connected: true, exists: true, repo, branch, hasPat: Boolean(token), html_url: repoInfo.html_url, isPrivate: repoInfo.private, default_branch: repoInfo.default_branch, error: `Branch ${branch} not found` });

    const commitData = await response.json();
    res.status(200).json({ connected: true, exists: true, repo, branch, hasPat: Boolean(token), html_url: repoInfo.html_url, isPrivate: repoInfo.private, lastCommit: { sha: commitData.sha, message: commitData.commit?.message, author: commitData.commit?.author?.name || commitData.author?.login, date: commitData.commit?.author?.date } });
  } catch (err: any) {
    res.status(200).json({ connected: false, repo: req.query.repo || '', branch: req.query.branch || 'main', hasPat: false, error: err.message });
  }
});

// POST /api/github/sync-push
router.post('/sync-push', async (req, res) => {
  try {
    const {
      customerName = '', appName = '', owner: requestedOwner = '', repo: requestedRepo = '',
      branch = 'main', token = process.env.GITHUB_TOKEN, commitMessage: customCommitMessage = '',
      isPrivate = false, createRepoIfMissing = true, triggerRenderDeploy: shouldTriggerDeploy = true
    } = req.body || {};

    if (!token) return res.status(400).json({ success: false, error: 'GitHub Personal Access Token (PAT) is required.' });

    const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Floe-Studio-App', 'Authorization': `Bearer ${token}` };

    const authUserRes = await fetch('https://api.github.com/user', { headers });
    if (!authUserRes.ok) {
      const errorText = await authUserRes.text();
      return res.status(401).json({ success: false, error: `Invalid GitHub token: ${errorText}` });
    }
    const authUser = await authUserRes.json();
    const authLogin = authUser.login;

    const sanitizeSlug = (str: string) => str.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    let targetOwner = requestedOwner ? requestedOwner.trim() : authLogin;
    let targetRepoName = '';
    if (requestedRepo && requestedRepo.includes('/')) {
      const parts = requestedRepo.split('/');
      targetOwner = parts[0].trim() || targetOwner;
      targetRepoName = sanitizeSlug(parts[1].trim());
    } else if (requestedRepo) {
      targetRepoName = sanitizeSlug(requestedRepo);
    } else if (customerName) {
      const custSlug = sanitizeSlug(customerName);
      const appSlug = appName ? sanitizeSlug(appName) : 'app';
      targetRepoName = custSlug.includes(appSlug) ? custSlug : `${custSlug}-${appSlug}`;
    } else if (appName) {
      targetRepoName = `floe-${sanitizeSlug(appName)}`;
    } else {
      targetRepoName = 'FloeFinal';
    }

    const fullRepoPath = `${targetOwner}/${targetRepoName}`;
    let createdNewRepo = false;

    console.info(`[Server:GitHub:sync-push] Target: ${fullRepoPath} (branch: ${branch}) | Customer: ${customerName} | App: ${appName}`);

    const checkRepoRes = await fetch(`https://api.github.com/repos/${fullRepoPath}`, { headers });
    if (!checkRepoRes.ok && checkRepoRes.status === 404 && createRepoIfMissing) {
      console.info(`[Server:GitHub:sync-push] Repo ${fullRepoPath} does not exist. Creating new customer repo...`);
      const isUserRepo = targetOwner.toLowerCase() === authLogin.toLowerCase();
      const createRepoUrl = isUserRepo ? 'https://api.github.com/user/repos' : `https://api.github.com/orgs/${targetOwner}/repos`;
      const createRes = await fetch(createRepoUrl, { method: 'POST', headers, body: JSON.stringify({ name: targetRepoName, description: customerName ? `Floe generated app for ${customerName}` : `Floe generated app`, private: Boolean(isPrivate), auto_init: true }) });
      if (!createRes.ok) {
        const createErr = await createRes.text();
        console.error(`[Server:GitHub:sync-push] Failed to create repo ${fullRepoPath}:`, createErr);
        return res.status(400).json({ success: false, error: `Failed to create repository "${fullRepoPath}": ${createErr}` });
      }
      createdNewRepo = true;
      console.info(`[Server:GitHub:sync-push] Successfully created repository ${fullRepoPath}. Waiting for initialization...`);
      await new Promise(r => setTimeout(r, 1500));
    } else if (!checkRepoRes.ok && checkRepoRes.status === 404) {
      console.warn(`[Server:GitHub:sync-push] Repo ${fullRepoPath} not found and auto-creation was disabled.`);
      return res.status(404).json({ success: false, error: `Repository ${fullRepoPath} not found and auto-creation was disabled.` });
    }

    let latestCommitSha: string | null = null;
    let baseTreeSha: string | null = null;
    const branchRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/branches/${branch}`, { headers });
    if (branchRes.ok) {
      const branchData = await branchRes.json();
      latestCommitSha = branchData.commit.sha;
      baseTreeSha = branchData.commit.commit.tree.sha;
    } else {
      const repoDetailsRes = await fetch(`https://api.github.com/repos/${fullRepoPath}`, { headers });
      if (repoDetailsRes.ok) {
        const repoDetails = await repoDetailsRes.json();
        const defaultBranchRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/branches/${repoDetails.default_branch || 'main'}`, { headers });
        if (defaultBranchRes.ok) {
          const defaultBranchData = await defaultBranchRes.json();
          latestCommitSha = defaultBranchData.commit.sha;
          baseTreeSha = defaultBranchData.commit.commit.tree.sha;
        }
      }
    }

    const getAllFiles = (dir: string, baseDir: string = dir): { path: string; local: string }[] => {
      const results: { path: string; local: string }[] = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (['node_modules', 'dist', '.git', '.bolt'].some(e => relativePath.startsWith(e)) || relativePath.endsWith('.sqlite') || relativePath.endsWith('.log') || relativePath === '.env') continue;
        if (item.isDirectory()) results.push(...getAllFiles(fullPath, baseDir));
        else if (item.isFile()) results.push({ path: relativePath, local: relativePath });
      }
      return results;
    };

    const treeItems: any[] = [];
    for (const f of getAllFiles(process.cwd())) {
      const localPath = path.join(process.cwd(), f.local);
      if (!fs.existsSync(localPath)) continue;
      try {
        const stat = fs.statSync(localPath);
        if (stat.size > 512 * 1024) continue;
        treeItems.push({ path: f.path, mode: '100644', type: 'blob', content: fs.readFileSync(localPath, 'utf-8') });
      } catch { /* skip unreadable */ }
    }
    if (treeItems.length === 0) return res.status(400).json({ success: false, error: 'No workspace files found to commit' });

    const treePayload: any = { tree: treeItems };
    if (baseTreeSha) treePayload.base_tree = baseTreeSha;
    const treeRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/trees`, { method: 'POST', headers, body: JSON.stringify(treePayload), signal: AbortSignal.timeout(10000) });
    if (!treeRes.ok) return res.status(400).json({ success: false, error: `Failed to create Git tree: ${await treeRes.text()}` });
    const newTreeData = await treeRes.json();

    const commitMsg = customCommitMessage || (customerName ? `feat(floe): generate enterprise ${appName || 'workflow application'} for ${customerName}` : `feat(floe): update application with latest domains and workflow engine`);
    const commitPayload: any = { message: commitMsg, tree: newTreeData.sha, parents: latestCommitSha ? [latestCommitSha] : [] };
    const commitRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/commits`, { method: 'POST', headers, body: JSON.stringify(commitPayload), signal: AbortSignal.timeout(8000) });
    if (!commitRes.ok) return res.status(400).json({ success: false, error: `Failed to create Git commit: ${await commitRes.text()}` });
    const newCommitData = await commitRes.json();

    const refCheckRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/refs/heads/${branch}`, { headers, signal: AbortSignal.timeout(6000) });
    if (refCheckRes.ok) {
      const refUpdateRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/refs/heads/${branch}`, { method: 'PATCH', headers, body: JSON.stringify({ sha: newCommitData.sha, force: true }), signal: AbortSignal.timeout(6000) });
      if (!refUpdateRes.ok) return res.status(400).json({ success: false, error: `Failed to update ref: ${await refUpdateRes.text()}` });
    } else {
      const createRefRes = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/refs`, { method: 'POST', headers, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommitData.sha }), signal: AbortSignal.timeout(6000) });
      if (!createRefRes.ok) return res.status(400).json({ success: false, error: `Failed to create ref: ${await createRefRes.text()}` });
    }

    let deployTriggered = false;
    if (shouldTriggerDeploy) {
      try {
        const services = await listRenderServices();
        const targetService = services.find((s) => s.name?.includes(targetRepoName) || s.name?.includes('floe') || s.repo?.includes(targetRepoName));
        if (targetService?.id) { await triggerRenderDeploy(targetService.id, true); deployTriggered = true; }
      } catch { /* non-fatal */ }
    }

    res.status(200).json({ success: true, message: createdNewRepo ? `Created repository "${fullRepoPath}" and pushed ${treeItems.length} files.` : `Synced ${treeItems.length} files to "${fullRepoPath}" (${branch}).`, repo: fullRepoPath, repoName: targetRepoName, owner: targetOwner, customerName: customerName || targetOwner, repoUrl: `https://github.com/${fullRepoPath}`, cloneUrl: `https://github.com/${fullRepoPath}.git`, createdNewRepo, commitSha: newCommitData.sha, treeSha: newTreeData.sha, deployTriggered });
  } catch (err: any) {
    console.error('[GitHub Sync] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
