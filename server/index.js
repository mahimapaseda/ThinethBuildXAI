/**
 * BuildX AI – Express Backend Server (AI-Only, No Auth)
 * Provides REST API for Gemini AI analysis — no authentication or database required.
 */
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import {
    validateApiKey, analyzeSite, refineBlueprint, generateBlueprintImage
} from './geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── AI Routes (BYOK — user sends their key via x-gemini-api-key header) ─────

/**
 * Middleware to extract and validate the Gemini API key from request headers.
 */
function geminiKeyMiddleware(req, res, next) {
    const apiKey = req.headers['x-gemini-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Gemini API key is required. Please set your API key.', code: 'MISSING_API_KEY' });
    }
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
        return res.status(401).json({ error: validation.error, code: 'INVALID_API_KEY' });
    }
    req.geminiApiKey = apiKey;
    next();
}

app.post('/api/ai/validate-key', (req, res) => {
    const apiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;
    if (!apiKey) return res.status(400).json({ valid: false, error: 'No API key provided.' });
    const validation = validateApiKey(apiKey);
    res.json(validation);
});

app.post('/api/ai/analyze', geminiKeyMiddleware, async (req, res) => {
    try {
        const { photos, specs, siteLocation } = req.body;
        if (!photos || !specs) return res.status(400).json({ error: 'Photos and specs are required.' });

        const result = await analyzeSite(req.geminiApiKey, photos, specs, siteLocation);
        res.json({ analysis: result });
    } catch (err) {
        console.error('AI analysis error:', err);
        const status = err.message.includes('invalid') || err.message.includes('expired') ? 401 : 500;
        res.status(status).json({ error: err.message || 'AI analysis failed.' });
    }
});

app.post('/api/ai/refine', geminiKeyMiddleware, async (req, res) => {
    try {
        const { currentAnalysis, feedback, specs } = req.body;
        if (!currentAnalysis || !feedback || !specs) return res.status(400).json({ error: 'Analysis, feedback, and specs are required.' });

        const result = await refineBlueprint(req.geminiApiKey, currentAnalysis, feedback, specs);
        res.json({ analysis: result });
    } catch (err) {
        console.error('AI refinement error:', err);
        const status = err.message.includes('invalid') || err.message.includes('expired') ? 401 : 500;
        res.status(status).json({ error: err.message || 'AI refinement failed.' });
    }
});

app.post('/api/ai/generate-image', geminiKeyMiddleware, async (req, res) => {
    try {
        const { specs, analysis } = req.body;
        if (!specs || !analysis) return res.status(400).json({ error: 'Specs and analysis are required.' });

        const result = await generateBlueprintImage(req.geminiApiKey, specs, analysis);
        res.json({ image: result });
    } catch (err) {
        console.error('AI image generation error:', err);
        res.status(500).json({ error: err.message || 'Image generation failed.' });
    }
});

// ─── Serve Frontend in Production ─────────────────────────────────────────────
const distPath = join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(join(distPath, 'index.html'));
        } else {
            next();
        }
    });
    console.log('📦 Serving production frontend from dist/');
}

// ─── Export app for Vercel serverless ─────────────────────────────────────────
export default app;

// ─── Start Server (local dev only — Vercel uses the export above) ─────────────
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n🏗️  BuildX AI Backend running on http://localhost:${PORT}`);
        console.log(`   API: http://localhost:${PORT}/api\n`);
    });
}
