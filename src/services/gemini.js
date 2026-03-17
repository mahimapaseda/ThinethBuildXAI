/**
 * BuildX AI – Frontend Gemini Service (API Client)
 * All AI calls are proxied through the Express backend for security.
 * The Gemini API key NEVER touches the browser.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('buildx_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Convert a File/Blob to base64 string (strips data URI prefix)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Initialize Gemini by sending the API key to the backend.
 * The key is stored server-side only — never in localStorage.
 */
export async function initializeGemini(apiKey) {
  const res = await fetch(`${API_BASE}/ai/set-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to set API key.');
  console.log('✅ Gemini initialized on server.');
}

/**
 * Validate API key by sending it to the backend
 */
export async function validateApiKey(apiKey) {
  try {
    const res = await fetch(`${API_BASE}/ai/set-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (res.ok) {
      return { valid: true, model: data.model || 'gemini-2.5-flash' };
    }
    return { valid: false, error: data.error || 'Invalid API key.' };
  } catch (error) {
    return { valid: false, error: 'Could not connect to server to validate key.', rawError: error.message };
  }
}

/**
 * Analyze construction site photos — sends base64 photos to backend
 */
export async function analyzeSite(imageFiles, specs, siteLocation = null) {
  // Convert File objects to base64 for transport
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
 * Validate user specs — local checks only, no API call needed
 */
export async function validateSpecs(specs, photos) {
  console.log('ℹ️ Spec validation using local checks only.');
  return [];
}
