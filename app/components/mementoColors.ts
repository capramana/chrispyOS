export const MEMENTO_COLORS = [
  { color: "#0a0908", label: "Black" },
  { color: "#ef233c", label: "Red" },
  { color: "#ffc300", label: "Yellow" },
  { color: "#6a994e", label: "Green" },
  { color: "#1e88e5", label: "Blue" },
] as const;

export type SocialType = "twitter" | "linkedin";

export const MEMENTO_SOCIAL_HANDLE_PLACEHOLDER: Record<SocialType, string> = {
  twitter: "@yourhandle",
  linkedin: "linkedin.com/in/",
};

export const MEMENTO_SOCIAL_OPTIONS = [
  {
    id: "twitter" as const,
    label: "X",
    favicon: "https://x.com/favicon.ico",
    color: "#0a0908",
  },
  {
    id: "linkedin" as const,
    label: "LinkedIn",
    favicon: "https://www.linkedin.com/favicon.ico",
    color: "#0a66c2",
  },
] as const;

const socialFavicon = (type: SocialType) =>
  MEMENTO_SOCIAL_OPTIONS.find((option) => option.id === type)!.favicon;

export const MEMENTO_HOST_PROFILES: Record<
  SocialType,
  { url: string; label: string; favicon: string }
> = {
  twitter: {
    url: "https://x.com/chrispramana",
    label: "@chrispramana",
    favicon: socialFavicon("twitter"),
  },
  linkedin: {
    url: "https://linkedin.com/in/capramana",
    label: "capramana",
    favicon: socialFavicon("linkedin"),
  },
};

export type MementoStep = 1 | 2 | 3;
