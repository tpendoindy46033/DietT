import type { Env } from "../env";
import { jsonOk, ApiHttpError } from "../json";
import { validateTextAnalysisInput } from "@shared/validation";
import { SAFETY_LIMITS } from "@shared/nutrition";
import { analyzeMealImage, analyzeMealText } from "../openai";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function handleAnalyzeText(env: Env, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const validation = validateTextAnalysisInput(body);
  if (!validation.valid || !validation.value) {
    throw new ApiHttpError("VALIDATION_ERROR", validation.errors.join(" "), 422);
  }

  const result = await analyzeMealText(env, validation.value.description);
  return jsonOk(result);
}

interface ImageAnalysisBody {
  imageBase64?: unknown;
  mimeType?: unknown;
  context?: unknown;
}

export async function handleAnalyzeImage(env: Env, request: Request): Promise<Response> {
  let body: ImageAnalysisBody;
  try {
    body = await request.json();
  } catch {
    throw new ApiHttpError("INVALID_BODY", "The request body must be valid JSON.", 400);
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const context = typeof body.context === "string" ? body.context.slice(0, 1000) : undefined;

  if (!imageBase64) {
    throw new ApiHttpError("VALIDATION_ERROR", "An image is required.", 422);
  }
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new ApiHttpError("INVALID_IMAGE", "Only JPEG, PNG and WebP images are supported.", 422);
  }

  const base64Payload = imageBase64.includes(",") ? imageBase64.split(",", 2)[1] : imageBase64;
  const approxBytes = Math.floor((base64Payload.length * 3) / 4);
  if (approxBytes > SAFETY_LIMITS.MAX_IMAGE_BYTES) {
    throw new ApiHttpError("IMAGE_TOO_LARGE", "That image is too large. Please use a photo under 5MB.", 413);
  }
  if (approxBytes === 0) {
    throw new ApiHttpError("INVALID_IMAGE", "That image could not be read. Please try a different photo.", 422);
  }

  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${base64Payload}`;

  const result = await analyzeMealImage(env, dataUrl, context);
  return jsonOk(result);
}
