const DEFAULT_REALTIME_MODEL = process.env.AI_REALTIME_MODEL || "gpt-4o-realtime-preview";
const DEFAULT_TRANSCRIPTION_MODEL = process.env.AI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
const DEFAULT_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || "0.6");
const DEFAULT_MAX_RESPONSE_OUTPUT_TOKENS = parseInt(process.env.AI_MAX_RESPONSE_OUTPUT_TOKENS || "2048", 10);
const DEFAULT_MAX_SESSION_DURATION_MS = parseInt(process.env.AI_MAX_SESSION_DURATION_MS || "0", 10);

function getPlanOverride(plan, key, parser = (val) => val) {
  const envKey = `AI_${key}_${plan.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw === undefined) return null;
  try {
    return parser(raw);
  } catch {
    return null;
  }
}

function parseNumber(raw) {
  const val = parseFloat(raw);
  return Number.isNaN(val) ? null : val;
}

function parseInteger(raw) {
  const val = parseInt(raw, 10);
  return Number.isNaN(val) ? null : val;
}

export function getModelRouting(plan, maxCallSeconds) {
  const planKey = (plan || "free").toLowerCase();
  const realtimeModel =
    getPlanOverride(planKey, "REALTIME_MODEL") || DEFAULT_REALTIME_MODEL;
  const transcriptionModel =
    getPlanOverride(planKey, "TRANSCRIPTION_MODEL") || DEFAULT_TRANSCRIPTION_MODEL;
  const temperature =
    getPlanOverride(planKey, "TEMPERATURE", parseNumber) ?? DEFAULT_TEMPERATURE;
  const maxResponseOutputTokens =
    getPlanOverride(planKey, "MAX_RESPONSE_OUTPUT_TOKENS", parseInteger) ??
    DEFAULT_MAX_RESPONSE_OUTPUT_TOKENS;
  const maxSessionDurationMs =
    getPlanOverride(planKey, "MAX_SESSION_DURATION_MS", parseInteger) ??
    DEFAULT_MAX_SESSION_DURATION_MS;
  const effectiveMaxSessionDurationMs =
    maxSessionDurationMs > 0 ? maxSessionDurationMs : (maxCallSeconds > 0 ? maxCallSeconds * 1000 : null);

  return {
    planKey,
    realtimeModel,
    transcriptionModel,
    temperature,
    maxResponseOutputTokens,
    maxSessionDurationMs: effectiveMaxSessionDurationMs,
  };
}
