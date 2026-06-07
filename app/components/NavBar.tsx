"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HomeSimple as HomeIcon, Edit as JournalIcon, BookmarkBook as GridIcon, HalfMoon as MoonIcon, SunLight as SunIcon, MailOut as MailIcon, Filter as FilterIcon, X as XIcon } from "iconoir-react";
import type { NavPage } from "../types/nav-page";
import MusicPlayer from "./MusicPlayer";
import NavButton from "./NavButton";
import { useClientMounted } from "./useClientMounted";
import { VAULT_NAV_Z_INDEX } from "./vaultRects";
import "./NavBar.css";

type NavBarProps = {
  activePage: NavPage;
  onActivePageChange: (page: NavPage) => void;
};

const expandTransition  = { type: "spring" as const, stiffness: 1100, damping: 60, mass: 2 };
const collapseTransition = { type: "tween" as const, ease: "easeInOut" as const, duration: 0.2 };

export default function NavBar({ activePage, onActivePageChange }: NavBarProps) {
  const mounted = useClientMounted();
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollHints, setScrollHints] = useState({ left: false, right: false });

  const showFilter = activePage === "writing" || activePage === "vault";

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const edge = 4;
    setScrollHints({
      left: el.scrollLeft > edge,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - edge,
    });
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const el = scrollRef.current;
    if (!el) return;

    const scheduleHints = () => requestAnimationFrame(updateScrollHints);

    scheduleHints();
    const inner = el.firstElementChild;
    const ro = new ResizeObserver(scheduleHints);
    ro.observe(el);
    if (inner) ro.observe(inner);

    el.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", scheduleHints);
    const afterLayout = window.setTimeout(scheduleHints, 320);

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", scheduleHints);
      window.clearTimeout(afterLayout);
    };
  }, [mounted, updateScrollHints, showFilter, activePage]);

  const handleNavMouseLeave = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setTooltipsReady(false), 300);
  };

  const handleNavMouseEnter = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const sharedProps = {
    tooltipsReady,
    onTooltipShown: () => setTooltipsReady(true),
    onTooltipReset: () => setTooltipsReady(false),
  };

  const bar = (
    <div
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 w-max max-w-[calc(100vw-3rem)] -translate-x-1/2 md:max-w-[calc(100vw-1.5rem)]"
      style={{ zIndex: VAULT_NAV_Z_INDEX }}
      onMouseEnter={handleNavMouseEnter}
      onMouseLeave={handleNavMouseLeave}
    >
      <motion.div
        layout
        transition={showFilter ? expandTransition : collapseTransition}
        onLayoutAnimationComplete={updateScrollHints}
        className="navbar-pill relative flex min-w-0 items-center overflow-hidden"
        style={{ background: "var(--navbar-bg)", borderRadius: 9999, willChange: "width" }}
      >
        <div className="navbar-shadow-overlay pointer-events-none absolute inset-0" style={{ borderRadius: 9999, border: "var(--navbar-border)", boxShadow: "var(--navbar-shadow)" }} />
        <div
          className={`navbar-pill-scroll-wrap${scrollHints.left ? " navbar-pill-scroll-wrap--overflow-left" : ""}${scrollHints.right ? " navbar-pill-scroll-wrap--overflow-right" : ""}`}
        >
          <div ref={scrollRef} className="navbar-pill-scroll">
            <div className="flex w-max shrink-0 items-center py-2 pl-3 pr-2">
              <NavButton icon={HomeIcon} label="Home" active={activePage === "home"} onClick={() => onActivePageChange("home")} {...sharedProps} />
              <div className="w-3 shrink-0" />
              <NavButton icon={JournalIcon} label="Writing" active={activePage === "writing"} onClick={() => onActivePageChange("writing")} {...sharedProps} />
              <div className="w-3 shrink-0" />
              <NavButton icon={GridIcon} label="Vault" active={activePage === "vault"} onClick={() => onActivePageChange("vault")} {...sharedProps} />
              <div className="w-3 shrink-0" />
              <div className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-[#444]" />

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
                    className="flex shrink-0 items-center"
                  >
                    <div className="w-3 shrink-0" />
                    <NavButton icon={FilterIcon} label="Filter" {...sharedProps} />
                    <div className="w-3 shrink-0" />
                    <div className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-[#444]" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-3 shrink-0" />
              <NavButton icon={isDark ? SunIcon : MoonIcon} label={isDark ? "Light mode" : "Dark mode"} iconKey={isDark ? "sun" : "moon"} iconAnimation={isDark ? "animate-icon-enter-sunrise" : "animate-icon-enter-sunset"} onClick={() => { const next = !isDark; setIsDark(next); document.documentElement.classList.add("theme-snap"); document.documentElement.classList.toggle("dark", next); document.documentElement.classList.add("theme-transitioning"); requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("theme-snap"))); setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 275); }} {...sharedProps} />
              <div className="w-3 shrink-0" />
              <NavButton icon={MailIcon} label="Email" href="mailto:christopher.apramana@gmail.com" {...sharedProps} />
              <div className="w-3 shrink-0" />
              <NavButton icon={XIcon} label="X profile" href="https://x.com/chrispramana" target="_blank" rel="noopener noreferrer" {...sharedProps} />
            </div>
          </div>
        </div>
        <div className="navbar-pill-music relative z-[1] flex shrink-0 items-center gap-1 py-2 pr-2 pl-1">
          <div className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-[#444]" />
          <MusicPlayer />
        </div>
      </motion.div>
    </div>
  );

  return mounted ? createPortal(bar, document.body) : null;
}
