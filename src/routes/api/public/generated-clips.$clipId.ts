import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GENERATED_CLIPS_BUCKET = "generated-clips";
const SIGNED_URL_TTL_SECONDS = 10 * 60;

export const Route = createFileRoute("/api/public/generated-clips/$clipId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { data: clip, error } = await supabaseAdmin
          .from("short_clips")
          .select("id, video_url, video_storage_path, title")
          .eq("id", params.clipId)
          .maybeSingle();

        if (error) {
          console.error("[generated-clips] lookup failed", error.message);
          return Response.json({ error: "Não foi possível localizar o corte." }, { status: 500 });
        }

        if (!clip) {
          return Response.json({ error: "Corte não encontrado." }, { status: 404 });
        }

        const url = new URL(request.url);
        const download = url.searchParams.get("download") === "1";

        if (clip.video_storage_path) {
          const filename =
            `${String(clip.title ?? `clip-${clip.id}`)
              .replace(/[^a-zA-Z0-9._-]+/g, "-")
              .replace(/^-+|-+$/g, "") || "vision-craft-clip"}.mp4`;

          const { data, error: signedUrlError } = await supabaseAdmin.storage
            .from(GENERATED_CLIPS_BUCKET)
            .createSignedUrl(clip.video_storage_path, SIGNED_URL_TTL_SECONDS, {
              download: download ? filename : false,
            });

          if (signedUrlError || !data?.signedUrl) {
            console.error("[generated-clips] signed URL failed", signedUrlError?.message);
            return Response.json(
              { error: "O arquivo renderizado ainda não está disponível." },
              { status: 404 },
            );
          }

          return Response.redirect(data.signedUrl, 302);
        }

        if (clip.video_url) {
          return Response.redirect(clip.video_url, 302);
        }

        return Response.json(
          { error: "O arquivo renderizado ainda não está disponível." },
          { status: 404 },
        );
      },
    },
  },
});
