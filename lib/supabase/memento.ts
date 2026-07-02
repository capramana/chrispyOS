import { createClient } from "@supabase/supabase-js";

export type MementoSubmission = {
  name: string;
  socialType: "twitter" | "linkedin";
  socialHandle: string;
  message: string;
  drawing: string;
};

const MAX_DRAWING_BYTES = 5 * 1024 * 1024;
export const MEMENTO_DRAWINGS_BUCKET = "memento-drawings";
const BUCKET = MEMENTO_DRAWINGS_BUCKET;

export type MementoEntryRow = {
  id: string;
  name: string;
  social_type: "twitter" | "linkedin";
  social_handle: string;
  message: string | null;
  drawing_path: string;
  submitted_at: string;
};

const MEMENTO_ENTRY_SELECT =
  "id, name, social_type, social_handle, message, drawing_path, submitted_at";

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

export async function listMementoEntries(): Promise<MementoEntryRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("memento_entries")
    .select(MEMENTO_ENTRY_SELECT)
    .order("submitted_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MementoEntryRow[];
}

export async function getMementoEntryById(
  id: string,
): Promise<MementoEntryRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("memento_entries")
    .select(MEMENTO_ENTRY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as MementoEntryRow | null;
}

export async function getMementoDrawing(id: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data: entry, error } = await supabase
    .from("memento_entries")
    .select("drawing_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !entry) {
    throw new Error("Drawing not found");
  }

  const { data, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(entry.drawing_path);

  if (downloadError || !data) {
    throw downloadError ?? new Error("Drawing not found");
  }

  return Buffer.from(await data.arrayBuffer());
}

const AVATAR_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

function avatarContentTypeForExtension(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function avatarExtensionForContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export async function getCachedMementoAvatar(
  id: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const supabase = getSupabaseAdmin();

  for (const ext of AVATAR_EXTENSIONS) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(`avatars/${id}.${ext}`);

    if (error || !data) continue;

    return {
      bytes: Buffer.from(await data.arrayBuffer()),
      contentType: avatarContentTypeForExtension(ext),
    };
  }

  return null;
}

export async function putCachedMementoAvatar(
  id: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const ext = avatarExtensionForContentType(contentType);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`avatars/${id}.${ext}`, bytes, { contentType, upsert: true });

  if (error) throw error;
}
