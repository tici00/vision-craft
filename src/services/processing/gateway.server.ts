/**
 * Server-only client for the external AI provider used by Vision Craft.
 *
 * AI calls made by the product must never depend on Lovable's AI Gateway or
 * workspace AI balance. The app uses its own provider credential instead.
 * Lovable remains only the development/hosting environment.
 */

const OPENAI_API_URL = "https://api.openai.com/v1";

/** Default text model used for timestamp-aware moment selection and scoring. */
export const ANALYSIS_MODEL = process.env["OPENAI_ANALYSIS_MODEL"] ?? "gpt-5-mini";

/** Default transcription model with real segment timestamps. */
export const TRANSCRIPTION_MODEL =
  process.env["OPENAI_TRANSCRIPTION_MODEL"] ?? "whisper-1";

export class AiGatewayError extends Error {
  status: number;
  code: string | null;
  providerType: string | null;

  constructor(status: number, message: string, code: string | null = null, providerType: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.providerType = providerType;
    this.name = "AiGatewayError";
  }
}

type ProviderErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string | null;
    param?: string | null;
  };
  message?: string;
};

function parseProviderError(body: string): ProviderErrorPayload {
  try {
    return JSON.parse(body) as ProviderErrorPayload;
  } catch {
    return {};
  }
}

function friendlyProviderMessage(status: number, body: string): string {
  const payload = parseProviderError(body);
  const providerError = payload.error;
  const message = providerError?.message ?? payload.message ?? body.slice(0, 500);
  const code = providerError?.code ?? null;
  const type = providerError?.type ?? null;

  if (status === 429) {
    const lower = `${message} ${code ?? ""} ${type ?? ""}`.toLowerCase();
    const isQuota =
      lower.includes("insufficient_quota") ||
      lower.includes("quota") ||
      lower.includes("billing") ||
      lower.includes("credits") ||
      lower.includes("exceeded your current quota");

    if (isQuota) {
      return `A IA externa recusou a requisição por quota/faturamento. Verifique o saldo, o faturamento e os limites de uso da conta OpenAI. [${code ?? type ?? "quota"}]`;
    }

    return `A IA externa recusou a requisição por limite de taxa (rate limit). Aguarde alguns segundos e tente novamente. [${code ?? type ?? "rate_limit"}]`;
  }

  switch (status) {
    case 400:
      return `A IA externa rejeitou a requisição: ${message}`;
    case 401:
      return "A chave da IA externa é inválida ou não foi aceita pelo provedor.";
    case 402:
      return "O saldo/faturamento da IA externa não está disponível para este processamento.";
    case 403:
      return `O acesso ao modelo de IA externa foi recusado pelo provedor: ${message}`;
    case 404:
      return `O modelo ou recurso de IA externa solicitado não está disponível: ${message}`;
    default:
      return `Falha na chamada da IA externa (${status}): ${message}`;
  }
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export interface ChatRequest {
  model?: string;
  system: string;
  parts: ContentPart[];
  maxOutputTokens?: number;
}

function requireApiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) {
    throw new AiGatewayError(
      500,
      "OPENAI_API_KEY não está configurada. Configure a chave da IA externa no ambiente do Vision Craft antes de processar vídeos.",
    );
  }
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
  };
}

/** Raw text completion from the external OpenAI API. */
export async function chatText({
  model = ANALYSIS_MODEL,
  system,
  parts,
  maxOutputTokens,
}: ChatRequest): Promise<string> {
  const textParts = parts.filter(
    (part): part is Extract<ContentPart, { type: "text" }> => part.type === "text",
  );

  if (textParts.length !== parts.length) {
    throw new AiGatewayError(
      400,
      "A chamada de análise textual recebeu áudio diretamente. Use o serviço de transcrição para mídia antes da seleção de cortes.",
    );
  }

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: textParts.map((part) => part.text).join("\n") },
      ],
      ...(maxOutputTokens ? { max_completion_tokens: maxOutputTokens } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiGatewayError(response.status, friendlyProviderMessage(response.status, body), parseProviderError(body).error?.code ?? null, parseProviderError(body).error?.type ?? null);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiGatewayError(502, "A IA externa retornou uma resposta vazia.");
  }
  return content;
}

/**
 * Transcribes an audio chunk through the external provider.
 *
 * Whisper's verbose JSON response supplies real segment timestamps, preserving
 * the pipeline's existing timestamp contract without relying on Lovable AI.
 */
export async function transcribeAudio(params: {
  data: string;
  format: string;
  languageHint: string | null;
  prompt: string;
}): Promise<{
  language: string | null;
  segments: { start: number; end: number; text: string }[];
}> {
  const bytes = Buffer.from(params.data, "base64");
  const mimeType = params.format === "wav" ? "audio/wav" : "audio/mpeg";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), `vision-craft.${params.format}`);
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");
  if (params.languageHint) form.append("language", params.languageHint);
  if (params.prompt) form.append("prompt", params.prompt);

  const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const parsed = parseProviderError(body);
    throw new AiGatewayError(
      response.status,
      friendlyProviderMessage(response.status, body),
      parsed.error?.code ?? null,
      parsed.error?.type ?? null,
    );
  }

  const payload = (await response.json()) as {
    language?: string | null;
    segments?: { start?: number; end?: number; text?: string }[];
  };

  return {
    language: payload.language?.trim() || params.languageHint || null,
    segments: (payload.segments ?? [])
      .map((segment) => ({
        start: Number(segment.start ?? 0),
        end: Number(segment.end ?? 0),
        text: (segment.text ?? "").trim(),
      }))
      .filter(
        (segment) =>
          Number.isFinite(segment.start) &&
          Number.isFinite(segment.end) &&
          segment.end > segment.start &&
          segment.text.length > 0,
      ),
  };
}

/** Strips markdown fences and parses the first JSON object/array in the text. */
export function parseJsonResponse<T>(raw: string): T {
  const withoutFences = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = withoutFences.search(/[[{]/);
  if (start === -1) throw new AiGatewayError(502, "A IA externa não retornou dados estruturados.");
  const opening = withoutFences[start];
  const closing = opening === "[" ? "]" : "}";
  const end = withoutFences.lastIndexOf(closing);
  const candidate = withoutFences.slice(start, end === -1 ? undefined : end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new AiGatewayError(502, "Não foi possível interpretar a resposta estruturada da IA externa.");
  }
}

export async function chatJson<T>(request: ChatRequest): Promise<T> {
  return parseJsonResponse<T>(await chatText(request));
}
