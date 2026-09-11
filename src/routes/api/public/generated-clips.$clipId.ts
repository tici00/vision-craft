import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GENERATED_CLIPS_BUCKET = "generated-clips";
const SIGNED_URL_TTL_SECONDS = 10 * 60;

function sanitizeFilename(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vision-craft-clip"
  );
}

export const Route = createFileRoute("/api/public/generated-clips/$clipId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const { data: clip, error } = await supabaseAdmin
            .from("short_clips")
            .select("id, video_url, video_storage_path, title")
            .eq("id", params.clipId)
            .maybeSingle();

          if (error) {
            console.error("[generated-clips] lookup failed", error.message);
            return Response.json(
              { error: "Não foi possível localizar o corte." },
              { status: 500 },
            );
          }

          if (!clip) {
            return Response.json({ error: "Corte não encontrado." }, { status: 404 });
          }

          const download = new URL(request.url).searchParams.get("download") === "1";
          const filename = `${sanitizeFilename(String(clip.title ?? `clip-${clip.id}`))}.mp4`;

          let sourceUrl: string | null = null;

          if (clip.video_storage_path) {
            const signed = await supabaseAdmin.storage
              .from(GENERATED_CLIPS_BUCKET)
              .createSignedUrl(clip.video_storage_path, SIGNED_URL_TTL_SECONDS);

            if (signed.error || !signed.data?.signedUrl) {
              console.error("[generated-clips] signed URL failed", signed.error?.message);
              return Response.json(
                { error: "O arquivo renderizado ainda não está disponível." },
                { status: 404 },
              );
            }

            sourceUrl = signed.data.signedUrl;
          } else if (clip.video_url && !clip.video_url.startsWith("/api/public/generated-clips/")) {
            sourceUrl = clip.video_url;
          }

          if (!sourceUrl) {
            return Response.json(
              { error: "O arquivo renderizado ainda não está disponível." },
              { status: 404 },
            );
          }

          // Proxy the media instead of redirecting to Storage. This keeps the
          // private bucket private and avoids browser/Lovable preview issues
          // with redirects to signed URLs. Forward Range so HTML5 video can
          // stream and seek normally.
          const upstreamHeaders = new Headers();
          const range = request.headers.get("range");
          if (range) upstreamHeaders.set("range", range);

          const upstream = await fetch(sourceUrl, { headers: upstreamHeaders });

          if (!upstream.ok && upstream.status !== 206) {
            console.error("[generated-clips] storage fetch failed", upstream.status);
            return Response.json(
              { error: "Não foi possível carregar o arquivo renderizado." },
              { status: upstream.status === 404 ? 404 : 502 },
            );
          }

          const responseHeaders = new Headers();
          for (const header of [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "etag",
            "last-modified",
            "cache-control",
          ]) {
            const value = upstream.headers.get(header);
            if (value) responseHeaders.set(header, value);
          }

          responseHeaders.set("Content-Type", "video/mp4");
          responseHeaders.set("Cache-Control", "private, max-age=300");
          responseHeaders.set("X-Content-Type-Options", "nosniff");

          if (download) {
            responseHeaders.set(
              "Content-Disposition",
              `attachment; filename="${filename}"`,
            );
          } else {
            responseHeaders.set("Content-Disposition", "inline");
          }

          return new Response(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha inesperada ao carregar o corte.";
          console.error("[generated-clips]", message);
          return Response.json(
            { error: "O serviço de mídia não conseguiu carregar este corte." },
            { status: 500 },
          );
        }
      },
    },
  },
});
