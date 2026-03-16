"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HomeSimple as HomeIcon, Edit as JournalIcon, BookmarkBook as GridIcon, HalfMoon as MoonIcon, SunLight as SunIcon, MailOut as MailIcon, Filter as FilterIcon } from "iconoir-react";
import MusicPlayer from "./MusicPlayer";
import NavButton from "./NavButton";
type Page = "home" | "writing" | "vault";

const expandTransition  = { type: "spring" as const, stiffness: 1100, damping: 60, mass: 2 };
const collapseTransition = { type: "tween" as const, ease: "easeInOut" as const, duration: 0.2 };

export default function NavBar() {
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activePage, setActivePage] = useState<Page>("home");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFilter = activePage === "writing" || activePage === "vault";

  const handleNavMouseLeave = () => {
    resetTimerRef.current = setTimeout(() => setTooltipsReady(false), 300);
  };

  const handleNavMouseEnter = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const sharedProps = { tooltipsReady, onTooltipShown: () => setTooltipsReady(true), onTooltipReset: () => setTooltipsReady(false) };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2" onMouseEnter={handleNavMouseEnter} onMouseLeave={handleNavMouseLeave}>
      <motion.div
        layout
        transition={showFilter ? expandTransition : collapseTransition}
        className="navbar-pill relative flex items-center pl-3 pr-2 py-2 overflow-visible"
        style={{ background: "var(--navbar-bg)", borderRadius: 9999 }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 9999, border: "var(--navbar-border)", boxShadow: "var(--navbar-shadow)" }} />
        <NavButton icon={HomeIcon} label="Home" active={activePage === "home"} onClick={() => setActivePage("home")} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <NavButton icon={JournalIcon} label="Writing" active={activePage === "writing"} onClick={() => setActivePage("writing")} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <NavButton icon={GridIcon} label="Vault" active={activePage === "vault"} onClick={() => setActivePage("vault")} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-[#444] shrink-0" />

        <AnimatePresence mode="popLayout">
          {showFilter && (
            <motion.div
              layout="position"
              variants={{
                visible: { opacity: 1, filter: "blur(0px)", scale: 1,   transition: { duration: 0.225, ease: "easeOut" } },
                hidden:  { opacity: 0, filter: "blur(4px)", scale: 0.85, transition: { duration: 0.1, ease: "easeInOut" } },
              }}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="flex items-center"
            >
              <div className="w-3 shrink-0" />
              <NavButton icon={FilterIcon} label="Filter" {...sharedProps} />
              <div className="w-3 shrink-0" />
              <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-[#444] shrink-0" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-3 shrink-0" />
        <NavButton icon={isDark ? SunIcon : MoonIcon} label={isDark ? "Light mode" : "Dark mode"} iconKey={isDark ? "sun" : "moon"} iconAnimation={isDark ? "animate-icon-enter-sunrise" : "animate-icon-enter-sunset"} onClick={() => { const next = !isDark; setIsDark(next); document.documentElement.classList.toggle("dark", next); document.documentElement.classList.add("theme-transitioning"); setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 275); }} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <NavButton icon={MailIcon} label="Email" href="mailto:christopher.apramana@gmail.com" {...sharedProps} />
        <div className="w-3 shrink-0" />
        <div className="w-2 shrink-0" />
        <MusicPlayer />
      </motion.div>
    </div>
  );
}
