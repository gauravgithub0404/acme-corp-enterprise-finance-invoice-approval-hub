import { Router } from 'express';
import { getSanitizedAiConfig, updateAiConfig, testAiConnection, generateWithAi, loadAiConfigFromDb, persistAiConfigToDb } from '../aiService';

const router = Router();

// GET /api/admin/ai-config
router.get('/ai-config', async (req, res) => {
  try {
    // Hydrate from DB on first access so config survives restarts
    await loadAiConfigFromDb();
    const config = getSanitizedAiConfig();
    res.status(200).json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ai-config — update and immediately persist
router.post('/ai-config', async (req, res) => {
  try {
    const updatedBy = (req.headers['x-floe-actor-id'] as string) || 'admin';
    const updated = updateAiConfig(req.body, updatedBy);
    // Issue 8: persist the updated config so it survives restarts
    await persistAiConfigToDb();
    res.status(200).json({ success: true, config: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/ai-test
router.post('/ai-test', async (req, res) => {
  try {
    const { provider, model, apiKey, baseUrl } = req.body || {};
    if (!provider) return res.status(400).json({ error: 'provider is required' });
    const testResult = await testAiConnection(provider, model, apiKey, baseUrl);
    res.status(200).json(testResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate (note: mounted under /api so full path is /api/ai/generate)
router.post('/generate', async (req, res) => {
  try {
    const { prompt, systemPrompt, model, provider, temperature, maxTokens, context } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    const result = await generateWithAi({ prompt, systemPrompt, model, provider, temperature, maxTokens, context });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
