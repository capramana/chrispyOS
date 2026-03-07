"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HomeSimple as HomeIcon, EditPencil as JournalIcon, BookmarkBook as GridIcon, HalfMoon as MoonIcon, SunLight as SunIcon, MailOut as MailIcon, Filter as FilterIcon } from "iconoir-react";
import MusicPlayer from "./MusicPlayer";
import NavButton from "./NavButton";

const springTransition = { type: "spring" as const, stiffness: 400, damping: 40 };

export default function NavBar() {
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activePage, setActivePage] = useState<"home" | "writing" | "vault">("home");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFilter = activePage === "writing" || activePage === "vault";

  const handleNavMouseLeave = () => {
    resetTimerRef.current = setTimeout(() => setTooltipsReady(false), 300);
  };

  const handleNavMouseEnter = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const sharedProps = { tooltipsReady, onTooltipShown: () => setTooltipsReady(true) };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2" onMouseEnter={handleNavMouseEnter} onMouseLeave={handleNavMouseLeave}>
      <motion.div
        layout
        transition={springTransition}
        style={{ borderRadius: 9999 }}
        className="flex items-center gap-3 border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm overflow-hidden"
      >
        <NavButton icon={HomeIcon} label="Home" active={activePage === "home"} onClick={() => setActivePage("home")} {...sharedProps} />
        <NavButton icon={JournalIcon} label="Writing" active={activePage === "writing"} onClick={() => setActivePage("writing")} {...sharedProps} />
        <NavButton icon={GridIcon} label="Vault" active={activePage === "vault"} onClick={() => setActivePage("vault")} {...sharedProps} />
        <div className="h-6 w-px bg-gray-200" />
        <AnimatePresence mode="popLayout">
          {showFilter && (
            <motion.div
              key="filter"
              className="flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { ...springTransition, delay: 0.05 } }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", transition: { duration: 0.15 } }}
            >
              <NavButton icon={FilterIcon} label="Filter" {...sharedProps} />
              <div className="h-6 w-px bg-gray-200" />
            </motion.div>
          )}
        </AnimatePresence>
        <NavButton icon={isDark ? SunIcon : MoonIcon} label={isDark ? "Light mode" : "Dark mode"} iconKey={isDark ? "sun" : "moon"} iconAnimation={isDark ? "animate-icon-enter-sunrise" : "animate-icon-enter-sunset"} onClick={() => setIsDark(!isDark)} {...sharedProps} />
        <NavButton icon={MailIcon} label="Email" href="mailto:christopher.apramana@gmail.com" {...sharedProps} />
        <MusicPlayer />
      </motion.div>
    </div>
  );
}
