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
      <h1 id="main-heading" className="transition-blur text-[clamp(28px,7.5vw,40px)] font-medium tracking-tight">
        <ChisledText>Chris Pramana</ChisledText>
      </h1>
      <p id="main-description" className="transition-blur mt-2 max-w-[min(460px,92vw)] text-[clamp(15px,3.8vw,18px)] leading-snug">
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

      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <HomeHero />
      </div>

      {(activePage === "writing" || activePage === "vault") && (
        <WorkInProgressSticker />
      )}

      {activePage === "vault" && <VaultArtifacts />}

      <div className="fixed bottom-12 left-12 hidden md:block" data-site-footer-corner>
        <div className="transition-blur-corner">
          <Clock />
        </div>
      </div>

      <NavBar activePage={activePage} onActivePageChange={setActivePage} />

      <div className="fixed bottom-12 right-12 hidden md:block" data-site-footer-corner>
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
