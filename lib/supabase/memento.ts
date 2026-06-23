import { createClient } from "@supabase/supabase-js";

export type MementoSubmission = {
  name: string;
  socialType: "twitter" | "linkedin";
  socialHandle: string;
  message: string;
  drawing: string;
};

const MAX_DRAWING_BYTES = 5 * 1024 * 1024;
const BUCKET = "memento-drawings";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parsePngDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Invalid drawing data");
  return Buffer.from(match[1], "base64");
}

export async function createMementoEntry(input: MementoSubmission) {
  const supabase = getSupabaseAdmin();
  const png = parsePngDataUrl(input.drawing);

  if (png.byteLength > MAX_DRAWING_BYTES) {
    throw new Error("Drawing is too large");
  }

  const id = crypto.randomUUID();
  const drawingPath = `${id}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(drawingPath, png, { contentType: "image/png", upsert: false });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("memento_entries").insert({
    id,
    name: input.name.slice(0, 200),
    social_type: input.socialType,
    social_handle: input.socialHandle.slice(0, 200),
    message: input.message.slice(0, 2000) || null,
    drawing_path: drawingPath,
  });

  if (insertError) throw insertError;
}
