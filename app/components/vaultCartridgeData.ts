export type VaultCartridgeKey =
  | "research"
  | "startup"
  | "dialectic"
  | "lex"
  | "founders"
  | "iltb"
  | "htbf"
  | "socialradars"
  | "deakins"
  | "acquired"
  | "shuffle";

export type VaultCartridgeItem = {
  id: VaultCartridgeKey;
  src: string;
  alt: string;
  videos: string | readonly string[];
};

const DIALECTIC_EMBEDS = [
  "https://www.youtube.com/embed/0PBgbS0N86I",
  "https://www.youtube.com/embed/JReNZ9X2IE0",
  "https://www.youtube.com/embed/rptQNq2ux90",
  "https://www.youtube.com/embed/dK_m-x81lrk",
] as const;

export const VAULT_CARTRIDGE_ITEMS: VaultCartridgeItem[] = [
  {
    id: "research",
    src: "/vault/cartridges/cartridge1.png",
    alt: "Research cartridge",
    videos: "https://www.youtube.com/embed/a1zDuOPkMSw",
  },
  {
    id: "startup",
    src: "/vault/cartridges/cartridge2.png",
    alt: "Startup cartridge",
    videos:
      "https://www.youtube.com/embed/CBYhVcO4WgI?list=PL5q_lef6zVkaTY_cT1k7qFNF2TidHCe-1",
  },
  {
    id: "dialectic",
    src: "/vault/cartridges/cartridge3.png",
    alt: "Dialectic cartridge",
    videos: DIALECTIC_EMBEDS,
  },
  {
    id: "lex",
    src: "/vault/cartridges/cartridge4.png",
    alt: "Lex cartridge",
    videos: [
      "https://www.youtube.com/embed/DcWqzZ3I2cY",
      "https://www.youtube.com/embed/pwN8u6HFH8U",
      "https://www.youtube.com/embed/XbPHojL_61U",
      "https://www.youtube.com/embed/2oxdDKHdcM8",
      "https://www.youtube.com/embed/9PIOoJMMptA",
    ],
  },
  {
    id: "founders",
    src: "/vault/cartridges/cartridge5.png",
    alt: "Founders cartridge",
    videos: [
      "https://www.youtube.com/embed/g6MEDOY7tHo",
      "https://www.youtube.com/embed/yY1Llgq1VbY",
      "https://www.youtube.com/embed/ZSM2uFnJ5bs",
      "https://www.youtube.com/embed/wLWBzHbD9jg",
      "https://www.youtube.com/embed/cT0Fo3rYJI4",
    ],
  },
  {
    id: "iltb",
    src: "/vault/cartridges/cartridge6.png",
    alt: "Invest Like the Best cartridge",
    videos: [
      "https://www.youtube.com/embed/m7H42MCzBCQ",
      "https://www.youtube.com/embed/Rt7_Uk4yVnk",
      "https://www.youtube.com/embed/JUsb1FYOstA",
      "https://www.youtube.com/embed/kAIVualeQjM",
      "https://www.youtube.com/embed/o3rrGzTDH4k",
    ],
  },
  {
    id: "htbf",
    src: "/vault/cartridges/cartridge7.png",
    alt: "How to Take Over the World cartridge",
    videos: [
      "https://www.youtube.com/embed/Lb4IcGF5iTQ",
      "https://www.youtube.com/embed/nFOC-cgIWaY",
      "https://www.youtube.com/embed/tnBQmEqBCY0",
      "https://www.youtube.com/embed/sYMqVwsewSg",
      "https://www.youtube.com/embed/U_g-fBfPOF8",
      "https://www.youtube.com/embed/zZN-3RpdjcY",
      "https://www.youtube.com/embed/TYt5yuiGk9E",
    ],
  },
  {
    id: "socialradars",
    src: "/vault/cartridges/cartridge8.png",
    alt: "Social Radars cartridge",
    videos: [
      "https://www.youtube.com/embed/8cSuWAABpyI",
      "https://www.youtube.com/embed/x8cjSgeLBGE",
      "https://www.youtube.com/embed/qP_L3xTS3rE",
      "https://www.youtube.com/embed/B8jL0OpwiM8",
      "https://www.youtube.com/embed/iLA5Y6vqd_I",
    ],
  },
  {
    id: "deakins",
    src: "/vault/cartridges/cartridge9.png",
    alt: "Deakins cartridge",
    videos: "https://www.youtube.com/embed/8n4bCLN3l9M",
  },
  {
    id: "acquired",
    src: "/vault/cartridges/cartridge10.png",
    alt: "Acquired cartridge",
    videos: [
      "https://www.youtube.com/embed/hMSiaUCJkmc",
      "https://www.youtube.com/embed/9PxxtJVWRrg",
      "https://www.youtube.com/embed/A0fvX-wV70Y",
      "https://www.youtube.com/embed/atMrnp_EVcI",
      "https://www.youtube.com/embed/2KjW4BqNFy0",
    ],
  },
  {
    id: "shuffle",
    src: "/vault/cartridges/cartridge11.png",
    alt: "Shuffle cartridge",
    videos: [
      "https://www.youtube.com/embed/d95J8yzvjbQ",
      "https://www.youtube.com/embed/OQ0OOzOwsJY",
      "https://www.youtube.com/embed/qrDZhAxpKrQ",
      "https://www.youtube.com/embed/tABT6GdygnI",
      "https://www.youtube.com/embed/54bQC8yGpLA",
      "https://www.youtube.com/embed/pqWUuYTcG-o",
      "https://www.youtube.com/embed/z6PHZJLo2Sk",
      "https://www.youtube.com/embed/IjoTYJNr8DA",
      "https://www.youtube.com/embed/elq1UYbJ-JQ",
    ],
  },
];

export const VAULT_GBA_BOOT_VIDEO = "/vault/gba-boot.mp4";

export function pickCartridgeEmbed(videos: string | readonly string[]) {
  if (typeof videos === "string") return videos;
  return videos[Math.floor(Math.random() * videos.length)]!;
}
