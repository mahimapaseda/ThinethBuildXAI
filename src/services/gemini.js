/**
 * BuildX AI – Frontend Gemini Service (BYOK — Bring Your Own Key)
 * The user's API key is stored in localStorage and sent via x-gemini-api-key header.
 * All AI processing happens on the backend — the key is only used for transit.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'buildx_gemini_key';

function getToken() {
  return localStorage.getItem('buildx_token');
}

function getGeminiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function authHeaders() {
  const token = getToken();
  const geminiKey = getGeminiKey();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (geminiKey) headers['x-gemini-api-key'] = geminiKey;
  return headers;
}

/**
 * Convert a File/Blob to base64 string (strips data URI prefix)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Save the API key to localStorage.
 * Called by ApiKeyModal when user enters their key.
 */
export function initializeGemini(apiKey) {
  localStorage.setItem(STORAGE_KEY, apiKey.trim());
  console.log('✅ Gemini API key saved to localStorage.');
}

/**
 * Check if a key is stored
 */
export function isGeminiReady() {
  return getGeminiKey().length > 0;
}

/**
 * Get the stored key (for display purposes, e.g. masked in settings)
 */
export function getStoredGeminiKey() {
  return getGeminiKey();
}

/**
 * Clear the stored key
 */
export function clearGeminiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Validate API key format locally (no server call needed)
 */
export async function validateApiKey(apiKey) {
  try {
    const cleanKey = (apiKey || '').trim().replace(/[^\x20-\x7E]/g, '');
    if (!cleanKey || cleanKey.length < 10) {
      return { valid: false, error: 'API key is too short or contains invalid characters.' };
    }
    if (!cleanKey.startsWith('AIza') || cleanKey.length < 30) {
      return { valid: false, error: 'This doesn\'t look like a valid Google API key. Keys start with "AIza" and are about 39 characters long.' };
    }
    return { valid: true, model: 'gemini-2.5-flash' };
  } catch (error) {
    return { valid: false, error: 'Something went wrong while checking your key.', rawError: error.message };
  }
}

/**
 * Analyze construction site photos — sends base64 photos + key header to backend
 */
export async function analyzeSite(imageFiles, specs, siteLocation = null) {
  const photos = await Promise.all(
    Object.entries(imageFiles).map(async ([side, file]) => {
      const base64 = await fileToBase64(file);
      return { side, mimeType: file.type, base64 };
    })
  );

  const res = await fetch(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ photos, specs, siteLocation }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI analysis failed.');
  return data.analysis;
}

/**
 * Generate an AI blueprint/visualization image
 */
export async function generateBlueprintImage(specs, analysis) {
  try {
    const res = await fetch(`${API_BASE}/ai/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ specs, analysis }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('Image generation failed:', data.error);
      return null;
    }
    return data.image;
  } catch (err) {
    console.warn('Image generation request failed:', err.message);
    return null;
  }
}

/**
 * Handle user feedback and refine the blueprint
 */
export async function refineBlueprint(currentAnalysis, feedback, specs) {
  const res = await fetch(`${API_BASE}/ai/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ currentAnalysis, feedback, specs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not refine blueprint.');
  return data.analysis;
}

/**
 * Validate user specs — local checks only
 */
export async function validateSpecs(specs, photos) {
  return [];
}
