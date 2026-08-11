/**
 * Thin server-only client for the Lovable AI Gateway.
 *
 * Every call here performs real work against a real model. There is no mock
 * path: when the gateway is unavailable the error is surfaced verbatim so the
 * job records an honest failure instead of inventing results.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

/** Multimodal model used for timestamped transcription and moment selection. */
export const ANALYSIS_MODEL = "google/gemini-3.6-flash";

export class AiGatewayError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AiGatewayError";
  }
}

function friendlyGatewayMessage(status: number, body: string): string {
  switch (status) {
    case 402:
      return "Créditos de IA esgotados no workspace. Adicione créditos para continuar o processamento.";
    case 403:
      return "A IA está desativada para este workspace. Ative-a nas configurações de conectores.";
    case 404:
      return "O recurso de IA necessário não está disponível para este workspace.";
    case 429:
      return "Limite de requisições de IA atingido. Tente novamente em alguns minutos.";
    default:
      return `Falha na chamada de IA (${status}): ${body.slice(0, 500)}`;
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
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    throw new AiGatewayError(
      500,
      "A chave de acesso da IA não está configurada neste ambiente. Conecte a IA do Lovable para executar a análise.",
    );
  }
  return key;
}

/** Raw text completion from a multimodal prompt. */
export async function chatText({
  model = ANALYSIS_MODEL,
  system,
  parts,
  maxOutputTokens,
}: ChatRequest): Promise<string> {
  const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
      ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiGatewayError(response.status, friendlyGatewayMessage(response.status, body));
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiGatewayError(502, "A IA retornou uma resposta vazia.");
  }
  return content;
}

/** Strips markdown fences and parses the first JSON object/array in the text. */
export function parseJsonResponse<T>(raw: string): T {
  const withoutFences = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = withoutFences.search(/[[{]/);
  if (start === -1) throw new AiGatewayError(502, "A IA não retornou dados estruturados.");
  const opening = withoutFences[start];
  const closing = opening === "[" ? "]" : "}";
  const end = withoutFences.lastIndexOf(closing);
  const candidate = withoutFences.slice(start, end === -1 ? undefined : end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new AiGatewayError(502, "Não foi possível interpretar a resposta estruturada da IA.");
  }
}

export async function chatJson<T>(request: ChatRequest): Promise<T> {
  return parseJsonResponse<T>(await chatText(request));
}
