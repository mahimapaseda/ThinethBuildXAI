/**
 * BuildX AI – Gemini AI Service
 * Handles site photo analysis and engineering recommendations using Google Gemini.
 * Features automatic model fallback and retry on rate limits.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;

// Models to try in order (fallback chain) — stable, widely available models first
const MODEL_CHAIN = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-1.0-pro',
];

/**
 * Sanitize API key to remove non-ASCII characters and invisible whitespace
 * that can cause "non ISO-8859-1" errors in browser Headers.
 */
function sanitizeApiKey(key) {
  if (!key) return '';
  // Remove non-breaking spaces, control characters, and non-ASCII points
  return key.trim().replace(/[^\x20-\x7E]/g, '');
}

/**
 * Initialize the Gemini client with user's API key
 */
export function initializeGemini(apiKey) {
  const cleanKey = sanitizeApiKey(apiKey);
  genAI = new GoogleGenerativeAI(cleanKey);
}

/**
 * Validate API key by making a quick test call
 */
export async function validateApiKey(apiKey) {
  try {
    const cleanKey = sanitizeApiKey(apiKey);
    if (!cleanKey || cleanKey.length < 10) {
      return { valid: false, error: 'API key is too short or contains invalid characters.' };
    }

    const testAI = new GoogleGenerativeAI(cleanKey);
    let lastError = null;

    // Try each model in the fallback chain
    for (const modelName of MODEL_CHAIN) {
      try {
        console.log(`🔍 Testing ${modelName}...`);
        const model = testAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
          generationConfig: { maxOutputTokens: 5 }
        });
        await result.response;
        console.log(`✅ ${modelName} is working.`);
        return { valid: true, model: modelName };
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        console.warn(`❌ ${modelName} test failed:`, msg);

        if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.toLowerCase().includes('expired')) {
          return { valid: false, error: 'Invalid or expired API key. Please check AI Studio for a fresh one.' };
        }

        if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
          return {
            valid: false,
            error: 'Permission Denied (403). Your key is valid, but it doesn\'t have access to this model. Check if your project is restricted or if you are in an unsupported region.'
          };
        }
      }
    }

    // All models failed
    const errorMsg = lastError?.message || '';
    let userError = `Connection failed: ${errorMsg}`;

    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      userError = 'API Key accepted, but Gemini API is still "Not Found". Since you enabled it: (1) Wait 5-10 mins for Google to sync. (2) Ensure a Billing Account is linked. (3) Try a key from aistudio.google.com (much more reliable).';
    } else if (errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
      userError = `Permission Denied. Raw Error: ${errorMsg}. This usually means your region is restricted or your project has a safety policy block.`;
    }

    return {
      valid: false,
      error: userError,
      rawError: errorMsg // Include for debug if needed
    };
  } catch (error) {
    console.error('Validation failed:', error);
    return { valid: false, error: 'Something went wrong while checking your key.' };
  }
}

/**
 * Convert a File/Blob to base64 for Gemini Vision
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
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout(promise, ms, label = 'API call') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/**
 * Try a Gemini API call with automatic model fallback and retry
 * @param {Function} callFn - Function that takes a model and makes the API call
 * @param {number} maxRetries - Max retries per model
 * @returns {Object} The API result
 */
async function callWithFallback(callFn, maxRetries = 1) {
  let lastError = null;

  for (const modelName of MODEL_CHAIN) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Trying ${modelName} (attempt ${attempt + 1})...`);
        const result = await withTimeout(callFn(model), 60000, modelName);
        console.log(`✅ Success with ${modelName}`);
        return result;
      } catch (error) {
        lastError = error;
        const msg = error.message || '';

        // Rate limit → wait and retry, then fall through to next model
        if (msg.includes('timed out')) {
          console.warn(`⏰ ${modelName} timed out, trying next model...`);
          break; // skip retries, go to next model
        }

        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          // Extract retry delay if available, default 5s
          const delayMatch = msg.match(/retry\s*(?:in|after|delay)?\s*[:\s]*(\d+(?:\.\d+)?)\s*s/i);
          const delaySec = delayMatch ? parseFloat(delayMatch[1]) : 5;
          const waitMs = Math.min(delaySec * 1000, 15000); // max 15s wait

          if (attempt < maxRetries) {
            console.warn(`⏳ Rate limited on ${modelName}, waiting ${waitMs / 1000}s before retry...`);
            await sleep(waitMs);
            continue;
          } else {
            console.warn(`❌ ${modelName} exhausted after ${maxRetries + 1} attempts, trying next model...`);
            break; // try next model
          }
        }

        // Auth error → don't retry
        if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('expired')) {
          throw new Error('API key has expired or is invalid. Please reset your key in the header and try again.');
        }

        // Other error → retry
        if (attempt < maxRetries) {
          console.warn(`⚠️ Error on ${modelName}, retrying in 3s...`, msg);
          await sleep(3000);
          continue;
        }
        break; // try next model
      }
    }
  }

  // All models and retries exhausted
  throw new Error(
    `All AI models are currently rate-limited. Please wait 1-2 minutes and try again.\n\n` +
    `Technical details: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Analyze construction site photos and generate a comprehensive engineering report
 */
export async function analyzeSite(imageFiles, specs, siteLocation = null) {
  if (!genAI) throw new Error('Gemini not initialized. Please set your API key.');

  // Convert all images to base64
  const imageParts = await Promise.all(
    Object.entries(imageFiles).map(async ([side, file]) => {
      const base64 = await fileToBase64(file);
      return {
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      };
    })
  );

  // Build location context if available
  let locationContext = '';
  if (siteLocation) {
    locationContext = `
**Site Location (GPS):**
- Coordinates: ${siteLocation.lat}, ${siteLocation.lng}
- Address: ${siteLocation.address || 'Not available'}
- Region: ${siteLocation.region || 'Not specified'}
- City: ${siteLocation.city || 'Not specified'}

Use this location to determine:
- Local soil type and bearing capacity typical for this region
- Seismic zone (per IS 1893 if in India)
- Climate conditions (rainfall, temperature extremes, wind speed)
- Local building code requirements
- Regional material availability and typical construction practices
`;
  }

  // Build building type context
  const buildingType = specs.buildingType || 'residential_house';
  let buildingTypeContext = '';
  if (buildingType !== 'residential_house') {
    const typeDescriptions = {
      compound_wall: 'This is a COMPOUND/BOUNDARY WALL, not a house. Focus on wall-specific engineering: footing design, wall stability, wind resistance, and pillar spacing.',
      retaining_wall: 'This is a RETAINING WALL to hold back soil/earth. Focus on lateral earth pressure, drainage behind wall, counterfort design, and sliding/overturning stability.',
      water_tank: 'This is a WATER TANK/RESERVOIR. Focus on waterproofing, hydrostatic pressure, tank wall thickness, base slab design, and water tightness per IS 3370.',
      commercial_building: 'This is a COMMERCIAL BUILDING. Consider higher live loads, larger spans, fire safety, accessibility requirements, and commercial building codes.',
      warehouse: 'This is a WAREHOUSE/INDUSTRIAL building. Consider large clear spans, portal frame design, industrial flooring, loading dock requirements.',
      multi_story: 'This is a MULTI-STORY BUILDING. Focus on frame design, shear walls, elevator core, seismic provisions, and progressive collapse prevention.',
      garage: 'This is a GARAGE/PARKING structure. Consider vehicle loads, clear height requirements, ramp design, and ventilation.',
      boundary_fence: 'This is a BOUNDARY FENCE/PILLAR structure. Focus on pillar foundation, spacing, height-to-thickness ratio, and wind load.',
    };
    buildingTypeContext = buildingType in typeDescriptions
      ? `\n**IMPORTANT – Building Type:** ${typeDescriptions[buildingType]}\n`
      : '';
  }

  const prompt = `You are a Senior Structural Engineer and Project Manager. 
Analyze the provided construction site photos (Front, Sides, and Ground close-up) and user specifications to generate a 100% ACCURATE engineering report.
${locationContext}${buildingTypeContext}
**Building Specifications:**
- Building Type: ${buildingType.replace(/_/g, ' ')}
- Building Area: ${specs.area} ${specs.unit}²
- Dimensions: ${specs.length} × ${specs.width} ${specs.unit}
- Total Height: ${specs.totalHeight} ${specs.unit}
- Number of Floors: ${specs.floors}
- Wall Thickness: ${specs.wallThickness} mm
- Wall Material: ${specs.wallType}
- User Vision: "${specs.description}"

**Your Task:**
Provide a professional Civil Engineering assessment following international standards (IS 456, ACI 318, Eurocodes). 

Return your response as a valid JSON object with the following structure:

{
  "siteAssessment": {
    "soilNature": "Detailed description of soil type, bearing capacity estimate, and moisture content observations",
    "terrainAnalysis": "Terrain slope, drainage efficiency, and site accessibility",
    "safetyConcerns": ["List of site-specific safety hazards identified from photos"]
  },
  "foundationEngineering": {
    "recommendedType": "e.g., Isolated Footing, Raft, or Strip",
    "depth": "Exact depth in meters with engineering justification",
    "width": "Exact width in meters",
    "reinforcement": "Basic steel bar sizing and spacing recommendation",
    "formulasUsed": ["Foundation formulas used for this calculation"]
  },
  "wiringAndElectrical": {
    "layoutStrategy": "Step-by-step guide on how to lay wires, conduit placement, and distribution board location",
    "safetyProtocols": "Earthing requirements and circuit protection advice",
    "estimatedPoints": "Estimate of light, fan, and power points needed for this area"
  },
  "concreteMixDesign": {
    "targetGrade": "e.g., M25",
    "ratio": "Cement:Sand:Aggregate ratio with water-cement ratio",
    "mixingInstructions": "Detailed mixing procedure for hand-mixing on site for beginners",
    "curingProcess": "Days and method for curing"
  },
  "materialEstimateSummary": {
    "cementBags": 0,
    "sandCft": 0,
    "aggregateCft": 0,
    "steelTons": 0,
    "bricksBlocks": 0,
    "currentMarketRateNotes": "Estimation of total cost based on common current market prices (note: user should verify locally)"
  },
  "stepByStepGuide": [
    {
      "phase": "e.g., Excavation",
      "steps": ["Task 1", "Task 2"],
      "safetyWarning": "Phase-specific safety warning"
    }
  ],
  "safetyWarnings": [
    "Critical site-wide safety measures for non-professionals"
  ],
  "blueprintDescription": "Extremely detailed architectural description for generating a 3D visualization.",
  "formulasAndCalculations": [
    "List of every formula applied: Area calculation, Concrete volume, Steel percentage, etc."
  ]
}

IMPORTANT: 
- Be extremely precise. 
- Explain everything for a person with ZERO construction knowledge.
- All calculations must be grounded in engineering reality based on the building size.`;

  const result = await callWithFallback(async (model) => {
    const res = await model.generateContent([
      { text: prompt },
      ...imageParts
    ]);
    return res;
  });

  const response = await result.response;
  const text = response.text();

  let parsed;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  return parsed;
}

/**
 * Generate an AI blueprint/visualization image of the building
 * Uses the gemini-2.0-flash-exp-image-generation model
 */
export async function generateBlueprintImage(specs, analysis) {
  if (!genAI) throw new Error('Gemini not initialized.');

  const foundationType = analysis.foundationRecommendation?.type || 'strip foundation';
  const wallDesc = specs.wallType === 'concrete_block' ? 'concrete block' : specs.wallType;
  const description = specs.description || 'residential building';

  const prompt = `Generate a professional architectural rendering of a ${specs.floors}-floor ${wallDesc} ${description}, dimensions approximately ${specs.length}x${specs.width} ${specs.unit}, with ${foundationType}. Show it as a clean, realistic front-elevation architectural visualization with clear structural details, proper proportions, surrounding landscape, and blue sky background. Make it look like a professional 3D architectural render.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const response = await result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];

    // Find the image part
    for (const part of parts) {
      if (part.inlineData) {
        return {
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    // No image found, return null
    console.warn('No image generated by AI');
    return null;
  } catch (error) {
    console.error('Image generation failed:', error.message);
    // Don't throw — image generation is optional, not critical
    return null;
  }
}

/**
 * Handle user feedback and refine the blueprint
 */
export async function refineBlueprint(currentAnalysis, feedback, specs) {
  if (!genAI) throw new Error('Gemini not initialized.');

  const prompt = `You are an expert Structural Engineer. The user has reviewed your previous construction blueprint and has some requested changes or questions.

**User Feedback:** "${feedback}"

**Current Blueprint Details:**
- Building: ${specs.length}x${specs.width} ${specs.unit} (${specs.floors} floors)
- Wall: ${specs.wallType} (Thickness: ${specs.wallThickness}mm)

**Your Task:**
Update the previous blueprint JSON to incorporate these changes. If the user asks for a change that is UNSAFE or against engineering rules, explain why in the "safetyWarnings" but still provide the best engineered alternative.

Return the FULL updated JSON object with the same structure as before.`;

  const result = await callWithFallback(async (model) => {
    const res = await model.generateContent([
      { text: prompt },
      { text: JSON.stringify(currentAnalysis) }
    ]);
    return res;
  });

  const response = await result.response;
  const text = response.text();

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse refinement:', text);
    throw new Error('Could not refine blueprint. Please try again.');
  }
}

/**
 * Validate user specs using AI to check if enough details are provided
 * Returns an array of missing items or empty array if all is good
 */
export async function validateSpecs(specs, photos) {
  if (!genAI) return []; // Skip if not initialized

  const prompt = `You are a Senior Structural Engineer pre-checking building specifications before running a full analysis.

**User Specifications:**
- Dimensions: ${specs.length} × ${specs.width} ${specs.unit}
- Height: ${specs.totalHeight} ${specs.unit}
- Floors: ${specs.floors}
- Wall: ${specs.wallType} (${specs.wallThickness}mm)
- Description: "${specs.description || 'Not provided'}"
- Photos uploaded: ${Object.keys(photos || {}).length} of 4

**Your Task:**
Check if these specs are SUFFICIENT to generate an accurate structural engineering analysis.
Only flag truly MISSING or PROBLEMATIC details.

Return a JSON array of issues (empty array [] if no issues):
[
  { "id": "unique_id", "label": "Short Label", "message": "Clear explanation of what's missing or wrong" }
]

IMPORTANT: Only flag genuinely missing critical information. Don't be overly strict — basic dimensions, floors, wall type, and a description are usually sufficient. Return [] if the specs look reasonable.`;

  try {
    const result = await callWithFallback(async (model) => {
      const res = await model.generateContent([{ text: prompt }]);
      return res;
    });

    const response = await result.response;
    const text = response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const issues = JSON.parse(cleaned);
    return Array.isArray(issues) ? issues : [];
  } catch (err) {
    console.warn('AI spec validation failed, skipping:', err.message);
    return []; // Don't block on validation failure
  }
}
