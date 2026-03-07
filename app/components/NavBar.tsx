"use client";

import { useState, useRef } from "react";
import { HomeSimple as HomeIcon, EditPencil as JournalIcon, BookmarkBook as GridIcon, HalfMoon as MoonIcon, SunLight as SunIcon, MailOut as MailIcon } from "iconoir-react";
import MusicPlayer from "./MusicPlayer";
import NavButton from "./NavButton";

export default function NavBar() {
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavMouseLeave = () => {
    resetTimerRef.current = setTimeout(() => setTooltipsReady(false), 300);
  };

  const handleNavMouseEnter = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const sharedProps = { tooltipsReady, onTooltipShown: () => setTooltipsReady(true) };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2" onMouseEnter={handleNavMouseEnter} onMouseLeave={handleNavMouseLeave}>
      <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm overflow-visible">
        <NavButton icon={HomeIcon} label="Home" active {...sharedProps} />
        <NavButton icon={JournalIcon} label="Writing" {...sharedProps} />
        <NavButton icon={GridIcon} label="Vault" {...sharedProps} />
        <div className="mx-1 h-6 w-px bg-gray-200" />
        <NavButton icon={isDark ? SunIcon : MoonIcon} label={isDark ? "Light mode" : "Dark mode"} iconKey={isDark ? "sun" : "moon"} iconAnimation={isDark ? "animate-icon-enter-up" : "animate-icon-enter-down"} onClick={() => setIsDark(!isDark)} {...sharedProps} />
        <NavButton icon={MailIcon} label="Email" href="mailto:christopher.apramana@gmail.com" {...sharedProps} />
        <div className="mx-1 h-6 w-px bg-gray-200" />
        <MusicPlayer />
      </div>
    </div>
  );
}
