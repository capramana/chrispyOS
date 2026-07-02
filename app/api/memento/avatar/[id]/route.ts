import { NextResponse } from "next/server";
import { guestBookSocialForEntry } from "@/lib/memento/guestBookPages";
import { fetchSocialAvatarImage } from "@/lib/memento/socialAvatar";
import {
  getCachedMementoAvatar,
  getMementoDrawing,
  getMementoEntryById,
  putCachedMementoAvatar,
} from "@/lib/supabase/memento";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const entry = await getMementoEntryById(id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    const social = guestBookSocialForEntry(entry);

    const cached = await getCachedMementoAvatar(id);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.bytes), {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    const avatar = await fetchSocialAvatarImage(
      social.social_type,
      social.social_handle,
    );

    if (avatar) {
      try {
        await putCachedMementoAvatar(id, avatar.bytes, avatar.contentType);
      } catch (cacheError) {
        console.error("Memento avatar cache write failed:", cacheError);
      }

      return new NextResponse(avatar.bytes, {
        headers: {
          "Content-Type": avatar.contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    const png = await getMementoDrawing(id);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Do not cache long-lived at the avatar URL — an earlier miss would
        // stick as the drawing even after a profile photo is stored.
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Memento avatar fetch failed:", error);
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }
}
