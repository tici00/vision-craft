import { chatJson as openAiChatJson, chatText as openAiChatText, transcribeAudio as openAiTranscribe, type ChatRequest, type ContentPart, AiGatewayError, parseJsonResponse } from "./gateway.server";

export type AiProviderName = "openai" | "gemini" | "local";

export const AI_PROVIDER = (process.env["AI_PROVIDER"] ?? "openai") as AiProviderName;

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const LOCAL_BASE_URL = (process.env["LOCAL_AI_BASE_URL"] ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");

function requireKey(name: string): string {
  const value = process.env[name];
  if (!value) throw new AiGatewayError(500, `${name} não está configurada para o provedor de IA selecionado.`);
  return value;
}

function providerModel(provider: AiProviderName, requested?: string): string {
  if (requested) return requested;
  if (provider === "gemini") return process.env["GEMINI_ANALYSIS_MODEL"] ?? "gemini-3.8-flash";
  if (provider === "local") return process.env["LOCAL_ANALYSIS_MODEL"] ?? "qwen2.5:7b-instruct";
  return process.env["OPENAI_ANALYSIS_MODEL"] ?? "gpt-5-mini";
}

function localHeaders(): HeadersInit {
  const key = process.env["LOCAL_AI_API_KEY"];
  return {
    "Content-Type": "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

async function openAiCompatibleChat(request: ChatRequest, provider: "gemini" | "local"): Promise<string> {
  const baseUrl = provider === "gemini" ? GEMINI_BASE_URL : LOCAL_BASE_URL;
  const headers: HeadersInit = provider === "gemini"
    ? { Authorization: `Bearer ${requireKey("GEMINI_API_KEY")}`, "Content-Type": "application/json" }
    : localHeaders();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: providerModel(provider, request.model),
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.parts.filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text").map((part) => part.text).join("\n") },
      ],
      ...(request.maxOutputTokens ? { max_completion_tokens: request.maxOutputTokens } : {}),
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiGatewayError(response.status, `Falha no provedor ${provider}: ${body.slice(0, 500)}`, null, provider);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new AiGatewayError(502, `O provedor ${provider} retornou uma resposta vazia.`, null, provider);
  return content;
}

function mimeType(format: string): string {
  switch (format.toLowerCase()) {
    case "wav": return "audio/wav";
    case "m4a": return "audio/mp4";
    case "ogg": return "audio/ogg";
    case "webm": return "audio/webm";
    case "flac": return "audio/flac";
    default: return "audio/mpeg";
  }
}

function parseTime(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*s?$/i);
  return match ? Number(match[1]) : null;
}

function collectWordAnnotations(value: unknown, out: { start: number; end: number; text: string }[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectWordAnnotations(item, out);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record["type"] === "word_info") {
    const start = parseTime(record["start_offset"]);
    const end = parseTime(record["end_offset"]);
    const text = typeof record["word"] === "string"
      ? record["word"]
      : typeof record["text"] === "string" ? record["text"] : "";
    if (start != null && end != null && end > start && text.trim()) out.push({ start, end, text: text.trim() });
  }
  for (const child of Object.values(record)) collectWordAnnotations(child, out);
}

function wordsToSegments(words: { start: number; end: number; text: string }[]): { start: number; end: number; text: string }[] {
  const sorted = [...words].sort((a, b) => a.start - b.start);
  const segments: { start: number; end: number; text: string }[] = [];
  let current: { start: number; end: number; text: string } | null = null;
  for (const word of sorted) {
    if (!current || word.start - current.end > 1.2 || current.text.length > 220) {
      if (current) segments.push(current);
      current = { ...word };
    } else {
      current.end = word.end;
      current.text = `${current.text} ${word.text}`.trim();
    }
  }
  if (current) segments.push(current);
  return segments;
}

async function geminiTranscribe(params: { data: string; format: string; languageHint: string | null; prompt: string }) {
  const apiKey = requireKey("GEMINI_API_KEY");
  const response = await fetch(GEMINI_INTERACTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model: process.env["GEMINI_TRANSCRIPTION_MODEL"] ?? "gemini-3.5-transcribe",
      input: [
        { type: "text", text: params.prompt },
        { type: "audio", data: params.data, mime_type: mimeType(params.format) },
      ],
      generation_config: {
        transcription_config: {
          ...(params.languageHint ? { language_codes: [params.languageHint] } : {}),
          mode: { type: "verbatim", timestamp_granularities: ["word"] },
        },
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiGatewayError(response.status, `Falha na transcrição Gemini: ${body.slice(0, 500)}`, null, "gemini");
  }
  const payload = await response.json();
  const words: { start: number; end: number; text: string }[] = [];
  collectWordAnnotations(payload, words);
  const segments = wordsToSegments(words);
  if (!segments.length) throw new AiGatewayError(502, "O Gemini não retornou timestamps de transcrição utilizáveis.", null, "gemini");
  return { language: params.languageHint, segments };
}

export async function chatText(request: ChatRequest): Promise<string> {
  if (AI_PROVIDER === "openai") return openAiChatText(request);
  return openAiCompatibleChat(request, AI_PROVIDER);
}

export async function chatJson<T>(request: ChatRequest): Promise<T> {
  if (AI_PROVIDER === "openai") return openAiChatJson<T>(request);
  return parseJsonResponse<T>(await chatText(request));
}

export async function transcribeAudio(params: {
  data: string;
  format: string;
  languageHint: string | null;
  prompt: string;
}): Promise<{ language: string | null; segments: { start: number; end: number; text: string }[] }> {
  if (AI_PROVIDER === "openai") return openAiTranscribe(params);
  if (AI_PROVIDER === "gemini") return geminiTranscribe(params);

  const form = new FormData();
  const bytes = Buffer.from(params.data, "base64");
  form.append("file", new Blob([bytes], { type: mimeType(params.format) }), `vision-craft.${params.format}`);
  form.append("model", process.env["LOCAL_TRANSCRIPTION_MODEL"] ?? "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");
  if (params.languageHint) form.append("language", params.languageHint);
  if (params.prompt) form.append("prompt", params.prompt);
  const response = await fetch(`${LOCAL_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: process.env["LOCAL_AI_API_KEY"] ? { Authorization: `Bearer ${process.env["LOCAL_AI_API_KEY"]}` } : {},
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiGatewayError(response.status, `Falha na transcrição local: ${body.slice(0, 500)}`, null, "local");
  }
  const payload = (await response.json()) as { language?: string; segments?: { start?: number; end?: number; text?: string }[] };
  return {
    language: payload.language?.trim() || params.languageHint || null,
    segments: (payload.segments ?? []).map((segment) => ({ start: Number(segment.start ?? 0), end: Number(segment.end ?? 0), text: (segment.text ?? "").trim() })).filter((segment) => segment.end > segment.start && segment.text),
  };
}

export function getActiveAiProvider(): AiProviderName { return AI_PROVIDER; }
