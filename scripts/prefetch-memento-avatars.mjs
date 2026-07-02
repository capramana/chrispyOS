import { createClient } from "@supabase/supabase-js";

const BUCKET = "memento-drawings";
const MIN_AVATAR_BYTES = 2500;

const EXCLUDED_NAMES = new Set(["chris pramana", "christopher pramana"]);
const EXCLUDED_IDS = new Set([
  "8da1cd98-6f1b-4ac6-9f66-8578601ca658",
  "1fa7093d-633a-4386-8ddd-4dd275b1c304",
]);

const SOCIAL_OVERRIDES = {
  "abf4b081-0fbd-4664-9455-bdc482d839e2": {
    socialType: "linkedin",
    socialHandle: "https://www.linkedin.com/in/hansonleung",
  },
  "ee13e4a7-1868-4700-95c5-fb1aa0986b13": {
    socialType: "linkedin",
    socialHandle: "https://www.linkedin.com/in/jackiehcrowley",
  },
  "a9099754-8df3-4a9c-8187-0aee60252944": {
    socialType: "linkedin",
    socialHandle: "https://www.linkedin.com/in/kisum-chan",
  },
  "9feb4e39-e63b-4a8f-9102-e23682a6803f": {
    socialType: "linkedin",
    socialHandle: "https://www.linkedin.com/in/luke-zane-228622118",
  },
  "6c0015e5-7ad1-4812-853a-643265ea9b9e": {
    socialType: "linkedin",
    socialHandle: "https://www.linkedin.com/in/carasilverman",
  },
  "66a7f371-7771-411e-a68e-ef70a9b529c1": {
    socialType: "twitter",
    socialHandle: "yinanz17",
  },
  "7a25d17a-0e4f-4c0f-9677-50877ee4722b": {
    socialType: "twitter",
    socialHandle: "calebwu_",
  },
  "2b35a4d5-c9e0-41a4-8a62-e9207639e748": {
    socialType: "twitter",
    socialHandle: "me____likex",
  },
  "18673006-7cfe-475a-8f9d-567067f3e12b": {
    socialType: "linkedin",
    socialHandle: "https://www.linkedin.com/in/zhiyuanchen1/",
  },
};

function socialForEntry(entry) {
  const override = SOCIAL_OVERRIDES[entry.id];
  if (override) return override;
  if (/linkedin\.com\/in\//i.test(entry.social_handle)) {
    return { socialType: "linkedin", socialHandle: entry.social_handle };
  }
  return { socialType: entry.social_type, socialHandle: entry.social_handle };
}

function profileSlug(handle, socialType) {
  const trimmed = handle.trim();
  if (!trimmed) return null;

  if (socialType === "linkedin") {
    const match = trimmed.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
    if (match) return decodeURIComponent(match[1]).toLowerCase();
    return (
      trimmed
        .replace(/^in\//i, "")
        .replace(/^@/, "")
        .replace(/\s+/g, "")
        .toLowerCase() || null
    );
  }

  const match = trimmed.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
  if (match) return match[1];
  return trimmed.replace(/^@/, "") || null;
}

function avatarExtension(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function hasCachedAvatar(sb, id) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .download(`avatars/${id}.${ext}`);
    if (!error && data) return true;
  }
  return false;
}

async function putCachedAvatar(sb, id, bytes, contentType) {
  const ext = avatarExtension(contentType);
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(`avatars/${id}.${ext}`, bytes, { contentType, upsert: true });
  if (error) throw error;
}

async function fetchUnavatarAvatar(socialType, slug) {
  const apiKey = process.env.UNAVATAR_API_KEY;
  const qs = apiKey ? `?token=${encodeURIComponent(apiKey)}` : "";
  const headers = apiKey
    ? { Accept: "image/*", "x-api-key": apiKey }
    : { Accept: "image/*" };

  const urls =
    socialType === "linkedin"
      ? [`https://unavatar.io/linkedin/${encodeURIComponent(slug)}${qs}`]
      : [
          `https://unavatar.io/x/${encodeURIComponent(slug)}${qs}`,
          `https://unavatar.io/twitter/${encodeURIComponent(slug)}${qs}`,
        ];

  for (const url of urls) {
    const res = await fetch(url, { redirect: "follow", headers });
    if (!res.ok) continue;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) continue;

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < MIN_AVATAR_BYTES) continue;

    return { bytes, contentType };
  }

  return null;
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!process.env.UNAVATAR_API_KEY) {
  console.warn(`
Warning: UNAVATAR_API_KEY is not set. Anonymous unavatar is capped at ~50/day,
which is not enough to prefetch the full guest book. Add a key from
https://unavatar.io/checkout then re-run this script.
`);
}

const sb = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data: entries, error } = await sb
  .from("memento_entries")
  .select("id,name,social_type,social_handle")
  .order("name");

if (error) throw error;

const visible = entries.filter(
  (entry) =>
    !EXCLUDED_IDS.has(entry.id) &&
    !EXCLUDED_NAMES.has(entry.name.trim().toLowerCase()),
);

let alreadyCached = 0;
let ok = 0;
const failed = [];

for (const entry of visible) {
  if (await hasCachedAvatar(sb, entry.id)) {
    alreadyCached += 1;
    continue;
  }

  const social = socialForEntry(entry);
  const slug = profileSlug(social.socialHandle, social.socialType);
  if (!slug || /\s/.test(slug) || slug.includes("(")) {
    failed.push(`${entry.name} — invalid handle`);
    continue;
  }

  const label =
    social.socialType === "linkedin" ? `in/${slug}` : `@${slug}`;
  const image = await fetchUnavatarAvatar(social.socialType, slug);

  if (!image) {
    failed.push(`${entry.name} (${label})`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    continue;
  }

  await putCachedAvatar(sb, entry.id, image.bytes, image.contentType);
  ok += 1;
  console.log(`  ✓ ${entry.name} (${label})`);
  await new Promise((resolve) => setTimeout(resolve, 200));
}

console.log(`
Done.
  Already cached: ${alreadyCached}
  Newly cached:   ${ok}
  Failed:         ${failed.length}
`);

if (failed.length) {
  console.log("Failures:");
  for (const line of failed) console.log(`  - ${line}`);
}
