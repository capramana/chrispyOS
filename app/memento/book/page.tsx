import type { Metadata } from "next";
import GuestBook from "@/app/components/GuestBook";
import {
  filterGuestBookEntries,
  groupMementoEntriesIntoPages,
  type GuestBookPageContent,
} from "@/lib/memento/guestBookPages";
import { listMementoEntries } from "@/lib/supabase/memento";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guestbook",
  robots: { index: false, follow: false },
};

export default async function GuestBookPage() {
  let pages: GuestBookPageContent[] = [];

  try {
    const entries = filterGuestBookEntries(await listMementoEntries());
    pages = groupMementoEntriesIntoPages(entries);
  } catch (error) {
    console.error("Guest book load failed:", error);
  }

  return <GuestBook pages={pages} />;
}
