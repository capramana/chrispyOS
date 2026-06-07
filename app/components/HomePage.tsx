"use client";

import { useState } from "react";
import type { NavPage } from "../types/nav-page";
import Clock from "./Clock";
import Graffiti from "./Graffiti";
import NavBar from "./NavBar";
import ChisledText from "./ChisledText";
import SiteHeader from "./SiteHeader";
import VaultArtifacts from "./VaultArtifacts";
import WorkInProgressSticker from "./WorkInProgressSticker";

function HomeHero() {
  return (
    <div>
      <h1 id="main-heading" className="transition-blur max-w-[calc(100vw-3rem)] text-[clamp(28px,7.5vw,40px)] font-medium tracking-tight md:max-w-none">
        <ChisledText>Chris Pramana</ChisledText>
      </h1>
      <p id="main-description" className="transition-blur mt-2 max-w-[min(460px,calc(100vw-3rem))] text-[clamp(15px,3.8vw,18px)] leading-snug md:max-w-[min(460px,92vw)]">
        <ChisledText sub>
          {`is obsessed with missions for generational progress. This season, he's building autonomy into the finance suite to extend the impact of capital.`}
        </ChisledText>
      </p>
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

      <div className="fixed bottom-6 left-12 hidden md:block" data-site-footer-corner>
        <div className="transition-blur-corner">
          <Clock />
        </div>
      </div>

      <NavBar activePage={activePage} onActivePageChange={setActivePage} />

      <div className="fixed bottom-6 right-12 hidden md:block" data-site-footer-corner>
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
