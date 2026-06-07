"use client";

import { useState } from "react";
import type { NavPage } from "../types/nav-page";
import Clock from "./Clock";
import Graffiti from "./Graffiti";
import NavBar from "./NavBar";
import ChisledText from "./ChisledText";
import {
  DESCRIPTION_SIZE,
  HERO_COMBINED_DARK_SRC,
  HERO_COMBINED_LIGHT_SRC,
  HERO_COMBINED_WIDTH,
  HERO_DESCRIPTION_TEXT,
  TITLE_SIZE,
} from "./heroCopy";
import SiteHeader from "./SiteHeader";
import { useIsDark } from "./useIsDark";
import VaultArtifacts from "./VaultArtifacts";
import WorkInProgressSticker from "./WorkInProgressSticker";

const heroCombinedMaxWidth = `min(${HERO_COMBINED_WIDTH}px, calc(100vw - 3rem))`;

function HomeHero() {
  const isDark = useIsDark();

  return (
    <div>
      <h1 className="sr-only">Chris Pramana</h1>
      <p className="sr-only">{HERO_DESCRIPTION_TEXT}</p>

      <figure
        data-hero-heading
        data-hero-description
        className="transition-blur m-0 md:hidden"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isDark ? HERO_COMBINED_DARK_SRC : HERO_COMBINED_LIGHT_SRC}
          alt=""
          draggable={false}
          width={HERO_COMBINED_WIDTH}
          className="block h-auto w-full"
          style={{ maxWidth: heroCombinedMaxWidth }}
        />
      </figure>

      <div className="hidden md:block" aria-hidden>
        <div
          data-hero-heading
          className="transition-blur max-w-[calc(100vw-3rem)] font-medium tracking-tight md:max-w-none"
          style={{ fontSize: TITLE_SIZE }}
        >
          <ChisledText>Chris Pramana</ChisledText>
        </div>
        <p
          data-hero-description
          className="transition-blur mt-2 max-w-[min(460px,calc(100vw-3rem))] leading-snug md:max-w-[min(460px,92vw)]"
          style={{ fontSize: DESCRIPTION_SIZE }}
        >
          <ChisledText sub>{HERO_DESCRIPTION_TEXT}</ChisledText>
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activePage, setActivePage] = useState<NavPage>("home");

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 md:px-12">
        <HomeHero />
      </div>

      {(activePage === "writing" || activePage === "vault") && (
        <WorkInProgressSticker />
      )}

      {activePage === "vault" && <VaultArtifacts />}

      <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-12 hidden h-[var(--navbar-pill-height)] items-center md:flex" data-site-footer-corner>
        <div className="transition-blur-corner">
          <Clock />
        </div>
      </div>

      <NavBar activePage={activePage} onActivePageChange={setActivePage} />

      <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-12 hidden h-[var(--navbar-pill-height)] items-center md:flex" data-site-footer-corner>
        <a
          href="https://x.com/chrispramana"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-blur-corner block font-mono text-base tracking-wide text-primary hover:underline"
        >
          @chrispramana
        </a>
      </div>

      <Graffiti />
    </div>
  );
}
