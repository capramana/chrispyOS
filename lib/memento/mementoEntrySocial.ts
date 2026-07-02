import type { MementoEntryRow } from "@/lib/supabase/memento";

/** Correct social profile when the stored submission handle is wrong. */
const MEMENTO_SOCIAL_OVERRIDES: Readonly<
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

function isLinkedInProfileHandle(handle: string): boolean {
  return /linkedin\.com\/in\//i.test(handle.trim());
}

export function mementoSocialForEntry(
  entry: Pick<MementoEntryRow, "id" | "social_type" | "social_handle">,
): Pick<MementoEntryRow, "social_type" | "social_handle"> {
  const override = MEMENTO_SOCIAL_OVERRIDES[entry.id];
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
