import type { Env } from "./env";
import { ApiHttpError } from "./json";
import { validateAiAnalysis } from "@shared/validation";
import type { AiAnalysisResult } from "@shared/types";
import { calculateTotals } from "@shared/nutrition";

/**
 * Hardcoded server-side. Never sourced from env, never exposed to or
 * selectable from the frontend, and never swapped for a fallback model.
 */
export const OPENAI_MODEL = "gpt-5-nano";

const FRIENDLY_FAILURE_MESSAGE =
  "We couldn't analyze this meal right now. Please try again or enter the nutrition details manually.";

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    foodName: { type: "string" },
    amount: { type: "number" },
    unit: { type: "string" },
    estimatedGrams: { type: "number" },
    calories: { type: "number" },
    proteinGrams: { type: "number" },
    carbohydrateGrams: { type: "number" },
    fatGrams: { type: "number" },
    fiberGrams: { type: "number" },
    preparation: { type: "string" },
    confidence: { type: "number" },
    assumptions: { type: "string" }
  },
  required: [
    "foodName",
    "amount",
    "unit",
    "estimatedGrams",
    "calories",
    "proteinGrams",
    "carbohydrateGrams",
    "fatGrams",
    "fiberGrams",
    "preparation",
    "confidence",
    "assumptions"
  ],
  additionalProperties: false
} as const;

const MEAL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    mealName: { type: "string" },
    mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
    items: { type: "array", items: ITEM_SCHEMA },
    totals: {
      type: "object",
      properties: {
        calories: { type: "number" },
        proteinGrams: { type: "number" },
        carbohydrateGrams: { type: "number" },
        fatGrams: { type: "number" },
        fiberGrams: { type: "number" }
      },
      required: ["calories", "proteinGrams", "carbohydrateGrams", "fatGrams", "fiberGrams"],
      additionalProperties: false
    },
    overallConfidence: { type: "number" },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: ["mealName", "mealType", "items", "totals", "overallConfidence", "warnings"],
  additionalProperties: false
} as const;

const SYSTEM_PROMPT = `You are a careful nutrition estimation assistant embedded in a personal diet-tracking app.
Given a description or photo of a meal, identify each distinct food item, estimate its portion size and weight
in grams, and estimate calories, protein, carbohydrates, fat and fiber for each item. Consider likely preparation
methods, oils, sauces, dressings and toppings. Always be explicit in "assumptions" about what you guessed. Never
claim exact certainty - use "confidence" (0 to 1) honestly, lower for photos with ambiguous portions or hidden
ingredients. Return a concise, sensible "mealName" and infer the most likely "mealType" (breakfast, lunch, dinner,
or snack) from context, defaulting to a reasonable guess if not stated. Add a "warnings" entry for anything that
significantly affects accuracy, such as an estimated serving size or a hidden sauce. Compute "totals" as the sum
of all items, but the app will independently recompute and use its own totals.`;

type ResponsesContentPart = { type: string; text?: string };
type ResponsesOutputItem = { type: string; content?: ResponsesContentPart[] };
interface ResponsesApiResult {
  output?: ResponsesOutputItem[];
  output_text?: string;
}

async function callResponsesApi(env: Env, input: unknown[]): Promise<AiAnalysisResult> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiHttpError("MISSING_OPENAI_KEY", "The OpenAI API key has not been configured for this deployment yet.", 500);
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "meal_analysis",
            schema: MEAL_ANALYSIS_SCHEMA,
            strict: true
          }
        },
        store: false
      })
    });
  } catch {
    throw new ApiHttpError("AI_NETWORK_ERROR", FRIENDLY_FAILURE_MESSAGE, 502);
  }

  if (!response.ok) {
    throw new ApiHttpError("AI_REQUEST_FAILED", FRIENDLY_FAILURE_MESSAGE, 502);
  }

  let payload: ResponsesApiResult;
  try {
    payload = await response.json();
  } catch {
    throw new ApiHttpError("AI_INVALID_RESPONSE", FRIENDLY_FAILURE_MESSAGE, 502);
  }

  const text = extractOutputText(payload);
  if (!text) {
    throw new ApiHttpError("AI_INVALID_RESPONSE", FRIENDLY_FAILURE_MESSAGE, 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiHttpError("AI_INVALID_RESPONSE", FRIENDLY_FAILURE_MESSAGE, 502);
  }

  const validation = validateAiAnalysis(parsed);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("AI_INVALID_RESPONSE", FRIENDLY_FAILURE_MESSAGE, 502);
  }

  const totals = calculateTotals(validation.value.items);
  return { ...validation.value, totals };
}

function extractOutputText(payload: ResponsesApiResult): string | null {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }
  if (!Array.isArray(payload.output)) return null;
  for (const item of payload.output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return null;
}

export async function analyzeMealText(env: Env, description: string, contextHint?: string): Promise<AiAnalysisResult> {
  const userText = contextHint ? `${description}\n\nAdditional context: ${contextHint}` : description;
  return callResponsesApi(env, [{ type: "input_text", text: userText }]);
}

export async function analyzeMealImage(
  env: Env,
  imageDataUrl: string,
  context?: string
): Promise<AiAnalysisResult> {
  const parts: unknown[] = [
    {
      type: "input_text",
      text: context
        ? `Analyze this meal photo. Additional context from the user: ${context}`
        : "Analyze this meal photo and identify each food item."
    },
    { type: "input_image", image_url: imageDataUrl }
  ];
  return callResponsesApi(env, parts);
}
