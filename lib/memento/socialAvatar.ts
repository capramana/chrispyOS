export type SocialType = "twitter" | "linkedin";

/** unavatar.io returns a tiny generic PNG when it cannot resolve a profile. */
const MIN_AVATAR_BYTES = 2500;

export function socialProfileSlug(
  handle: string,
  socialType: SocialType,
): string | null {
  let trimmed = handle.trim();
  if (!trimmed) return null;

  if (socialType === "linkedin") {
    const inMatch = trimmed.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
    if (inMatch) return decodeURIComponent(inMatch[1]);
    trimmed = trimmed.replace(/^in\//i, "").replace(/^@/, "");
    return trimmed.replace(/\s+/g, "").toLowerCase() || null;
  }

  const xMatch = trimmed.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
  if (xMatch) return xMatch[1];
  return trimmed.replace(/^@/, "") || null;
}

function unavatarTokenQuery(token?: string): string {
  const resolved =
    token ??
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_UNAVATAR_TOKEN
      : undefined);
  return resolved ? `?token=${encodeURIComponent(resolved)}` : "";
}

function unavatarFetchHeaders(): HeadersInit {
  const apiKey = process.env.UNAVATAR_API_KEY;
  return apiKey
    ? { Accept: "image/*", "x-api-key": apiKey }
    : { Accept: "image/*" };
}

/** Client-side avatar URLs — one per provider fallback. */
export function socialAvatarUrls(
  socialType: SocialType,
  handle: string,
  options?: { token?: string },
): string[] {
  const slug = socialProfileSlug(handle, socialType);
  if (!slug) return [];

  const qs = unavatarTokenQuery(options?.token);
  const encoded = encodeURIComponent(slug);

  if (socialType === "linkedin") {
    return [`https://unavatar.io/linkedin/${encoded}${qs}`];
  }

  return [
    `https://unavatar.io/x/${encoded}${qs}`,
    `https://unavatar.io/twitter/${encoded}${qs}`,
  ];
}

function unavatarUrls(socialType: SocialType, slug: string): string[] {
  const encoded = encodeURIComponent(slug);
  const qs = unavatarTokenQuery(process.env.UNAVATAR_API_KEY);

  if (socialType === "twitter") {
    return [
      `https://unavatar.io/x/${encoded}${qs}`,
      `https://unavatar.io/twitter/${encoded}${qs}`,
    ];
  }
  return [`https://unavatar.io/linkedin/${encoded}${qs}`];
}

export async function fetchSocialAvatarImage(
  socialType: SocialType,
  handle: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const slug = socialProfileSlug(handle, socialType);
  if (!slug) return null;

  for (const url of unavatarUrls(socialType, slug)) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: unavatarFetchHeaders(),
        next: { revalidate: 60 * 60 * 24 * 7 },
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) continue;

      const bytes = await res.arrayBuffer();
      if (bytes.byteLength < MIN_AVATAR_BYTES) continue;

      return { bytes, contentType };
    } catch {
      continue;
    }
  }

  return null;
}
