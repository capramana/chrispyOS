import type { MementoEntryRow } from "@/lib/supabase/memento";

export const MAX_DRAWINGS_PER_PAGE = 5;
export const DEFAULT_GUEST_BOOK_PAGE_COUNT = 10;

/** Host entries — stored in Supabase but omitted from the public guest book. */
const GUEST_BOOK_EXCLUDED_NAMES = new Set([
  "chris pramana",
  "christopher pramana",
]);

/** Specific submissions omitted from the book (duplicate or one-off). */
const GUEST_BOOK_EXCLUDED_ENTRY_IDS = new Set([
  "8da1cd98-6f1b-4ac6-9f66-8578601ca658", // flo — duplicate (Jun 24)
  "1fa7093d-633a-4386-8ddd-4dd275b1c304", // Giang Tran — duplicate (Jun 25)
  "f8a55173-ed8a-4a0c-85ac-241501f6688c", // yinan — duplicate (Jun 30)
]);

/** Credit a submission to a different calendar day than submitted_at (UTC). */
const GUEST_BOOK_DATE_OVERRIDES: Readonly<Record<string, string>> = {
  "abf4b081-0fbd-4664-9455-bdc482d839e2": "2026-06-28", // Hanson
  "2ac6e1af-e977-41c9-acb8-45b3a8712c1b": "2026-06-28", // Kaitlin Chow
  "be0d8bf0-5e90-49ad-866e-130ac80e8000": "2026-06-28", // Haolun Yang
};

/** Correct social profile when the stored submission handle is wrong. */
const GUEST_BOOK_SOCIAL_OVERRIDES: Readonly<
  Record<
    string,
    {
      socialType: MementoEntryRow["social_type"];
      socialHandle: string;
    }
  >
> = {
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

/** Display name when the stored submission name is informal or incomplete. */
const GUEST_BOOK_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "abf4b081-0fbd-4664-9455-bdc482d839e2": "Hanson Leung",
  "04cac6a9-91be-4067-a094-a16a969b5237": "Dave Hwang",
  "e004d25b-4d52-4d30-9610-893b5e439e2d": "Flora Guo",
  "d22ef638-f2b4-4910-b695-39e0acecf7c3": "Emmi Wu",
  "3fa7399f-0a3f-4c63-b3c2-e8b35d2c1d93": "Jean Chu",
  "6de676aa-f197-4e8d-8f70-9989845fce84": "Keyan Virani",
  "0c91ce33-1e60-40fd-8505-0633e8ad2e45": "Pauline Wee",
  "d544a7d0-fa51-45c6-8980-3ab37d9c37be": "Jade Franson",
  "c384aee8-579e-40ed-8ab2-a391321538e9": "Josh Wolk",
  "ce572f77-1f3f-4e6f-880c-62ebd7f969af": "Haruka Shimizu",
  "8c7aaab0-02fd-4dff-9ce7-9613fe427100": "Song You",
  "47c910dd-04ac-4c13-8432-52749baa92ca": "Thalal Cassim",
  "f16d732d-7cc9-434a-8655-13f161cfd5ca": "Elizabeth Lin",
  "f323f86f-854b-4a48-bb7b-4ccdfd3ea099": "Evan Pun",
  "e25c25d1-cdf8-4ec9-9c9d-2ad97547176d": "Osmond Wu",
  "66a7f371-7771-411e-a68e-ef70a9b529c1": "Yinan Zhang",
  "be0d8bf0-5e90-49ad-866e-130ac80e8000": "Haolun Yang",
  "46afe3fe-3ba4-498c-8d7a-d3b629dedfa6": "Daniel Fu",
};

function guestBookTitleCaseWord(word: string): string {
  if (!word) return word;

  const lower = word.toLowerCase();

  if (lower.startsWith("mc") && lower.length > 2) {
    return `Mc${lower.charAt(2).toUpperCase()}${lower.slice(3)}`;
  }

  if (lower.startsWith("mac") && lower.length > 3) {
    return `Mac${lower.charAt(3).toUpperCase()}${lower.slice(4)}`;
  }

  if (word.length === 1) {
    return word.toUpperCase();
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Title-case each word for guest book display (names from the form vary in casing). */
export function guestBookFormatDisplayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(guestBookTitleCaseWord)
    .join(" ");
}

export function guestBookNameForEntry(
  entry: Pick<MementoEntryRow, "id" | "name">,
): string {
  const raw = GUEST_BOOK_NAME_OVERRIDES[entry.id] ?? entry.name;
  return guestBookFormatDisplayName(raw);
}

function isLinkedInProfileHandle(handle: string): boolean {
  return /linkedin\.com\/in\//i.test(handle.trim());
}

export function guestBookSocialForEntry(
  entry: Pick<MementoEntryRow, "id" | "social_type" | "social_handle">,
): Pick<MementoEntryRow, "social_type" | "social_handle"> {
  const override = GUEST_BOOK_SOCIAL_OVERRIDES[entry.id];
  if (override) {
    return {
      social_type: override.socialType,
      social_handle: override.socialHandle,
    };
  }

  if (isLinkedInProfileHandle(entry.social_handle)) {
    return {
      social_type: "linkedin",
      social_handle: entry.social_handle,
    };
  }

  return {
    social_type: entry.social_type,
    social_handle: entry.social_handle,
  };
}

function guestBookDrawingFromEntry(entry: MementoEntryRow): GuestBookDrawing {
  const social = guestBookSocialForEntry(entry);
  return {
    id: entry.id,
    name: guestBookNameForEntry(entry),
    socialType: social.social_type,
    socialHandle: social.social_handle,
  };
}

/** Drawn on its own page, edge-to-edge (with inset), not scattered. */
export const GUEST_BOOK_FULL_PAGE_DRAWING_IDS = new Set([
  "0b33eb71-db8c-49a7-b495-1326e3382883", // Naheel
]);

/** Optional salt mixed into scatter-layout seed (one-off re-rolls). */
export const GUEST_BOOK_LAYOUT_SEED_OVERRIDES: Readonly<Record<string, string>> =
  {};

export function guestBookLayoutSeedForDate(
  date: string | undefined,
): string | undefined {
  if (!date) return undefined;
  return GUEST_BOOK_LAYOUT_SEED_OVERRIDES[date];
}

/** Scatter layout scale multiplier (1 = default). */
export const GUEST_BOOK_DRAWING_SCALE_OVERRIDES: Readonly<
  Record<string, number>
> = {
  "abf4b081-0fbd-4664-9455-bdc482d839e2": 2, // Hanson
};

export function guestBookDrawingLayoutScale(id: string): number {
  return GUEST_BOOK_DRAWING_SCALE_OVERRIDES[id] ?? 1;
}

export function isGuestBookFullPageDrawing(id: string): boolean {
  return GUEST_BOOK_FULL_PAGE_DRAWING_IDS.has(id);
}

export function isGuestBookExcludedEntry(
  entry: Pick<MementoEntryRow, "id" | "name">,
): boolean {
  return (
    GUEST_BOOK_EXCLUDED_ENTRY_IDS.has(entry.id) ||
    GUEST_BOOK_EXCLUDED_NAMES.has(entry.name.trim().toLowerCase())
  );
}

export function filterGuestBookEntries(
  entries: MementoEntryRow[],
): MementoEntryRow[] {
  return entries.filter((entry) => !isGuestBookExcludedEntry(entry));
}

export type GuestBookDrawing = {
  id: string;
  name: string;
  socialType: MementoEntryRow["social_type"];
  socialHandle: string;
};

export type GuestBookPageContent = {
  /** Calendar day in UTC (YYYY-MM-DD). */
  date: string;
  drawings: GuestBookDrawing[];
};

export function guestBookDrawingById(
  pages: GuestBookPageContent[],
  id: string,
): GuestBookDrawing | null {
  for (const page of pages) {
    for (const drawing of page.drawings) {
      if (drawing.id === id) return drawing;
    }
  }
  return null;
}

/** UTC date key — entries on the same calendar day share a page (up to 5). */
export function dayKeyFromSubmittedAt(submittedAt: string): string {
  return submittedAt.slice(0, 10);
}

function dayKeyForEntry(entry: MementoEntryRow): string {
  return (
    GUEST_BOOK_DATE_OVERRIDES[entry.id] ??
    dayKeyFromSubmittedAt(entry.submitted_at)
  );
}

/** e.g. `2026-06-23` → `Sun, June 23` */
export function formatGuestBookPageDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Groups memento drawings into book pages:
 * - one page = one calendar day (UTC), up to 5 drawings
 * - days never share a page
 * - if a day has ≤5 drawings they stay on one page; >5 splits into 5+5+… chunks
 */
export function groupMementoEntriesIntoPages(
  entries: MementoEntryRow[],
): GuestBookPageContent[] {
  const byDay = new Map<string, MementoEntryRow[]>();

  for (const entry of entries) {
    const day = dayKeyForEntry(entry);
    const list = byDay.get(day);
    if (list) list.push(entry);
    else byDay.set(day, [entry]);
  }

  const sortedDays = [...byDay.keys()].sort();
  const pages: GuestBookPageContent[] = [];

  for (const day of sortedDays) {
    const dayEntries = byDay.get(day)!;
    let chunk: MementoEntryRow[] = [];

    const flushChunk = () => {
      if (chunk.length === 0) return;
      pages.push({
        date: day,
        drawings: chunk.map(guestBookDrawingFromEntry),
      });
      chunk = [];
    };

    for (const entry of dayEntries) {
      if (isGuestBookFullPageDrawing(entry.id)) {
        flushChunk();
        pages.push({
          date: day,
          drawings: [guestBookDrawingFromEntry(entry)],
        });
        continue;
      }

      chunk.push(entry);
      if (chunk.length >= MAX_DRAWINGS_PER_PAGE) {
        flushChunk();
      }
    }

    flushChunk();
  }

  return pages;
}

/** 1-indexed page numbers visible on a spread step. */
export function guestBookPageNumbersOnSpread(
  spreadStep: number,
): [number, number] {
  return [spreadStep * 2 - 1, spreadStep * 2];
}

export function guestBookIsPageOnSpread(
  pageNumber: number,
  spreadStep: number,
): boolean {
  const [left, right] = guestBookPageNumbersOnSpread(spreadStep);
  return pageNumber === left || pageNumber === right;
}

/** Book spread step that shows a given content page (1-indexed). */
export function guestBookStepForPageNumber(pageNumber: number): number {
  return Math.ceil(pageNumber / 2);
}

export type GuestBookSearchEntry = {
  id: string;
  name: string;
  socialType: MementoEntryRow["social_type"];
  socialHandle: string;
  pageNumber: number;
};

function extractLinkedInSlug(handle: string): string | null {
  const trimmed = handle.trim();
  const urlMatch = trimmed.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (urlMatch) return decodeURIComponent(urlMatch[1]);
  const prefixMatch = trimmed.match(/^in\/([^/?#\s]+)/i);
  if (prefixMatch) return decodeURIComponent(prefixMatch[1]);
  return null;
}

export function normalizeGuestBookHandle(handle: string): string {
  const linkedinSlug = extractLinkedInSlug(handle);
  if (linkedinSlug) return linkedinSlug.toLowerCase();

  let normalized = handle.trim().toLowerCase();
  const urlMatch = normalized.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/);
  if (urlMatch) normalized = urlMatch[1];
  return normalized.replace(/^@/, "").replace(/^in\//i, "");
}

export function formatGuestBookHandleDisplay(
  handle: string,
  socialType?: MementoEntryRow["social_type"],
): string {
  const trimmed = handle.trim();
  if (!trimmed) return trimmed;

  const linkedinSlug = extractLinkedInSlug(trimmed);
  if (linkedinSlug || socialType === "linkedin") {
    const slug = linkedinSlug ?? normalizeGuestBookHandle(trimmed);
    return slug ? `in/${slug}` : trimmed;
  }

  const normalized = normalizeGuestBookHandle(trimmed);
  return normalized ? `@${normalized}` : trimmed;
}

export function buildGuestBookSearchIndex(
  pages: GuestBookPageContent[],
): GuestBookSearchEntry[] {
  return pages.flatMap((page, index) =>
    page.drawings.map((drawing) => ({
      id: drawing.id,
      name: drawing.name,
      socialType: drawing.socialType,
      socialHandle: drawing.socialHandle,
      pageNumber: index + 1,
    })),
  );
}

export function searchGuestBookEntries(
  index: GuestBookSearchEntry[],
  query: string,
  limit = 8,
): GuestBookSearchEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const q = trimmed.toLowerCase();
  const handleQ = normalizeGuestBookHandle(trimmed);

  return index
    .filter((entry) => {
      const name = entry.name.toLowerCase();
      const handle = normalizeGuestBookHandle(entry.socialHandle);
      return (
        name.includes(q) ||
        handle.includes(handleQ) ||
        handle.includes(q.replace(/^@/, ""))
      );
    })
    .slice(0, limit);
}

/** Random index entry not on the current spread (any entry if spread is closed). */
export function guestBookRandomSearchEntryOffSpread(
  index: GuestBookSearchEntry[],
  spreadStep: number | null,
): GuestBookSearchEntry | null {
  if (index.length === 0) return null;

  const pool =
    spreadStep !== null && spreadStep >= 1
      ? index.filter(
          (entry) => !guestBookIsPageOnSpread(entry.pageNumber, spreadStep),
        )
      : index;

  const pickFrom = pool.length > 0 ? pool : index;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? null;
}

/** Book spreads need an even page count; pad with one blank page when odd. */
export function guestBookPageCount(contentPages: GuestBookPageContent[]): number {
  if (contentPages.length === 0) return DEFAULT_GUEST_BOOK_PAGE_COUNT;
  const count = contentPages.length;
  return count % 2 === 0 ? count : count + 1;
}
