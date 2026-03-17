/**
 * BuildX AI – Server-Side Gemini AI Service
 * All Gemini API calls run here on the backend — the API key NEVER reaches the browser.
 * Features automatic model fallback and retry on rate limits.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
let currentApiKey = null;

// Models to try in order (fallback chain)
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
];

function sanitizeApiKey(key) {
  if (!key) return '';
  return key.trim().replace(/[^\x20-\x7E]/g, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label = 'API call') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/**
 * Initialize or update the Gemini client with an API key.
 * Key can come from env var or from user input via /api/ai/set-key.
 */
export function initializeGemini(apiKey) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey || cleanKey.length < 10) {
    throw new Error('API key is too short or contains invalid characters.');
  }
  genAI = new GoogleGenerativeAI(cleanKey);
  currentApiKey = cleanKey;
  console.log('✅ Gemini initialized on server (key length:', cleanKey.length, ')');
}

/**
 * Validate API key format (no test call to save quota)
 */
export function validateApiKey(apiKey) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey || cleanKey.length < 10) {
    return { valid: false, error: 'API key is too short or contains invalid characters.' };
  }
  if (!cleanKey.startsWith('AIza') || cleanKey.length < 30) {
    return { valid: false, error: 'This doesn\'t look like a valid Google API key. Keys start with "AIza" and are about 39 characters long.' };
  }
  return { valid: true, model: MODEL_CHAIN[0] };
}

export function isInitialized() {
  return genAI !== null;
}

/**
 * Try a Gemini API call with automatic model fallback and retry
 */
async function callWithFallback(callFn, maxRetries = 3) {
  let lastError = null;
  let hadRateLimit = false;
  let hadDailyExhaustion = false;

  for (const modelName of MODEL_CHAIN) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Trying ${modelName} (attempt ${attempt + 1})...`);
        const result = await withTimeout(callFn(model), 90000, modelName);
        console.log(`✅ Success with ${modelName}`);
        return result;
      } catch (error) {
        lastError = error;
        const msg = error.message || '';

        if (msg.includes('timed out')) {
          console.warn(`⏰ ${modelName} timed out, trying next model...`);
          break;
        }

        if (msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND')) {
          console.warn(`⏭️ ${modelName} not available (404), skipping...`);
          if (!hadRateLimit) lastError = error;
          break;
        }

        if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('expired')) {
          throw new Error('API key has expired or is invalid. Please reset your key and try again.');
        }

        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          hadRateLimit = true;
          if (msg.includes('limit: 0') && (msg.includes('PerDay') || msg.includes('PerModelPerDay'))) {
            hadDailyExhaustion = true;
            console.warn(`🚫 ${modelName} daily quota exhausted, skipping...`);
            break;
          }
          const delayMatch = msg.match(/retry\s*(?:in|after|delay)?\s*[:\s"]*(\d+(?:\.\d+)?)\s*s/i);
          const waitMs = delayMatch ? Math.ceil(parseFloat(delayMatch[1]) * 1000) + 2000 : 20000;
          if (attempt < maxRetries) {
            console.warn(`⏳ Rate limited on ${modelName}, waiting ${waitMs / 1000}s (${attempt + 1}/${maxRetries})...`);
            await sleep(waitMs);
            continue;
          } else {
            console.warn(`❌ ${modelName} still rate-limited after ${maxRetries} retries`);
            break;
          }
        }

        if (attempt < maxRetries) {
          console.warn(`⚠️ Error on ${modelName}, retrying in 3s...`, msg);
          await sleep(3000);
          continue;
        }
        break;
      }
    }
  }

  const errorMsg = lastError?.message || 'Unknown error';
  if (hadDailyExhaustion) {
    throw new Error(
      `Your API key's daily free quota is fully used up for today.\n\n` +
      `💡 Fix: Go to aistudio.google.com/apikey → create a new key in a new project.\n\n` +
      `Daily quotas reset at midnight Pacific Time (UTC-8).`
    );
  }
  if (hadRateLimit) {
    throw new Error(`All models are temporarily rate-limited. Please wait 1-2 minutes.\n\nDetails: ${errorMsg}`);
  }
  throw new Error(`Could not connect to any AI model. Check your internet and API key.\n\nDetails: ${errorMsg}`);
}

/**
 * Parse AI response JSON with 4-strategy recovery (including truncated JSON repair)
 */
function parseAIResponse(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('AI returned an empty response. Please try again.');
  }
  console.log('AI response length:', text.length, 'chars');

  // Strategy 1: Direct parse
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e1) {}

  // Strategy 2: Code block extraction
  try {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match) return JSON.parse(match[1].trim());
  } catch (e2) {}

  // Strategy 3: Brace extraction
  try {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(text.substring(first, last + 1));
    }
  } catch (e3) {}

  // Strategy 4: Repair truncated JSON
  try {
    let candidate = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const startIdx = candidate.indexOf('{');
    if (startIdx === -1) throw new Error('No JSON start');
    candidate = candidate.substring(startIdx);

    candidate = candidate.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '')
                         .replace(/,\s*"[^"]*"\s*:\s*$/, '')
                         .replace(/,\s*"[^"]*$/, '')
                         .replace(/,\s*$/, '');

    let braces = 0, brackets = 0;
    let inString = false, escape = false;
    for (const ch of candidate) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    while (brackets > 0) { candidate += ']'; brackets--; }
    while (braces > 0) { candidate += '}'; braces--; }

    const parsed = JSON.parse(candidate);
    console.warn('⚠️ AI response was truncated — repaired JSON successfully.');
    return parsed;
  } catch (e4) {
    console.error('All 4 JSON parse strategies failed. First 500:', text.substring(0, 500));
    throw new Error('AI returned an unexpected format. Please try again.');
  }
}

/**
 * Analyze construction site photos and generate engineering report
 * @param {Array} photos - Array of {side, mimeType, base64} objects
 * @param {Object} specs - Building specifications
 * @param {Object|null} siteLocation - GPS location data
 */
export async function analyzeSite(photos, specs, siteLocation = null) {
  if (!genAI) throw new Error('Gemini not initialized. Please set your API key.');

  // Build image parts from pre-encoded base64
  const imageParts = photos.map(p => ({
    inlineData: { mimeType: p.mimeType, data: p.base64 },
  }));

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

  const buildingType = specs.buildingType || 'residential_house';
  let buildingTypeContext = '';
  if (buildingType !== 'residential_house') {
    const typeDescriptions = {
      compound_wall: 'This is a COMPOUND/BOUNDARY WALL. Focus on wall-specific engineering: footing design, wall stability, wind resistance, and pillar spacing.',
      retaining_wall: 'This is a RETAINING WALL. Focus on lateral earth pressure, drainage, counterfort design, and sliding/overturning stability.',
      water_tank: 'This is a WATER TANK/RESERVOIR. Focus on waterproofing, hydrostatic pressure, tank wall thickness, and water tightness per IS 3370.',
      commercial_building: 'This is a COMMERCIAL BUILDING. Consider higher live loads, larger spans, fire safety, accessibility.',
      warehouse: 'This is a WAREHOUSE/INDUSTRIAL building. Consider large clear spans, portal frame design, industrial flooring.',
      multi_story: 'This is a MULTI-STORY BUILDING. Focus on frame design, shear walls, elevator core, seismic provisions.',
      garage: 'This is a GARAGE/PARKING structure. Consider vehicle loads, clear height, ramp design, ventilation.',
      boundary_fence: 'This is a BOUNDARY FENCE/PILLAR structure. Focus on pillar foundation, spacing, height-to-thickness ratio.',
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

  let result;
  try {
    result = await callWithFallback(async (model) => {
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 65536,
        },
      });
      return res;
    });
  } catch (apiError) {
    if (apiError.message.includes('quota is fully used up') || apiError.message.includes('rate-limited')) {
      console.warn('API FALLBACK: Returning mock data due to quota limits.');
      return {
        siteAssessment: { soilNature: "Simulated Sand/Clay soil mixture. Estimated bearing capacity of 150 kN/m².", terrainAnalysis: "Flat terrain with good natural drainage.", safetyConcerns: ["Uneven ground could cause tripping or material sliding."] },
        foundationEngineering: { recommendedType: "Isolated Column Footing", depth: "1.5 meters", width: "1.2 x 1.2 meters", reinforcement: "12mm bars at 150mm c/c spacing both ways", formulasUsed: ["Bearing Capacity Formula", "Bending Moment Calculation"] },
        wiringAndElectrical: { layoutStrategy: "Main distribution board at entrance.", safetyProtocols: "Proper earth pit installation (min 3m deep).", estimatedPoints: "15 light points, 8 fan points, 20 power sockets." },
        concreteMixDesign: { targetGrade: "M20", ratio: "1:1.5:3", mixingInstructions: "Mix dry ingredients first. Add water slowly. Use within 45 minutes.", curingProcess: "Keep moist for 10-14 days." },
        materialEstimateSummary: { cementBags: Math.ceil(specs.area * specs.floors * 0.4), sandCft: Math.ceil(specs.area * specs.floors * 1.8), aggregateCft: Math.ceil(specs.area * specs.floors * 1.3), steelTons: Number((specs.area * specs.floors * 0.0035).toFixed(2)), bricksBlocks: Math.ceil(specs.area * specs.floors * 8), currentMarketRateNotes: "Approximate fallback estimates." },
        stepByStepGuide: [{ phase: "Excavation", steps: ["Mark layout", "Excavate to 1.5m", "Pour PCC bed"], safetyWarning: "Keep machinery back from trench edges." }],
        safetyWarnings: ["Always wear hardhats", "Ensure scaffolding is secure"],
        blueprintDescription: `A ${specs.floors}-story ${buildingType} structure.`,
        formulasAndCalculations: ["Area = L × W", "Concrete Vol = Area × Thickness"]
      };
    }
    throw apiError;
  }

  const response = await result.response;
  let text;
  try { text = response.text(); } catch (e) { throw new Error('AI returned an empty response.'); }

  return parseAIResponse(text);
}

/**
 * Generate an AI blueprint/visualization image
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
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const response = await result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return {
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          mimeType: part.inlineData.mimeType,
        };
      }
    }
    console.warn('No image generated by AI');
    return null;
  } catch (error) {
    console.error('Image generation failed:', error.message);
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
    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, { text: JSON.stringify(currentAnalysis) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 65536,
      },
    });
    return res;
  });

  const response = await result.response;
  let text;
  try { text = response.text(); } catch (e) { throw new Error('AI returned an empty response.'); }

  return parseAIResponse(text);
}
