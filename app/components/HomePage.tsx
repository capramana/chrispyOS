"use client";

import { useState } from "react";
import type { NavPage } from "../types/nav-page";
import Clock from "./Clock";
import NavBar from "./NavBar";
import WorkExperience from "./WorkExperience";
import ChisledText from "./ChisledText";
import Graffiti from "./Graffiti";
import VaultArtifacts from "./VaultArtifacts";

function HomeHero() {
  return (
    <div>
      <h1 id="main-heading" className="transition-blur text-[40px] font-medium tracking-tight">
        <ChisledText>Chris Pramana</ChisledText>
      </h1>
      <p id="main-description" className="transition-blur mt-2 text-lg max-w-[460px]">
        <ChisledText sub>
          {`aims to build a world of abundance. In this season, he's making capital more efficient for businesses.`}
        </ChisledText>
      </p>
    </div>
  );
}

export default function HomePage() {
  const [activePage, setActivePage] = useState<NavPage>("home");

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <div className="fixed top-12 left-12">
        <span className="transition-blur-corner inline-block font-mono text-base tracking-wide text-primary">
          new york, ny
        </span>
      </div>

      <div className="fixed top-12 right-12">
        <div className="transition-blur-logo">
          <WorkExperience />
        </div>
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <HomeHero />
      </div>

      {activePage === "vault" && <VaultArtifacts />}

      <div className="fixed bottom-12 left-12">
        <div className="transition-blur-corner">
          <Clock />
        </div>
      </div>

      <NavBar activePage={activePage} onActivePageChange={setActivePage} />

      <div className="fixed bottom-12 right-12">
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
