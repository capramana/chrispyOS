"use client";

import { useState, useRef, useEffect } from "react";
import { HomeSimple as HomeIcon, EditPencil as JournalIcon, BookmarkBook as GridIcon, HalfMoon as MoonIcon, SunLight as SunIcon, MailOut as MailIcon, Filter as FilterIcon } from "iconoir-react";
import MusicPlayer from "./MusicPlayer";
import NavButton from "./NavButton";
import "./NavBar.css";

type Page = "home" | "writing" | "vault";
type FilterAnim = "collapsed" | "expanding" | "expanded" | "collapsing";

const FILTER_WIDTH = 80;

export default function NavBar() {
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activePage, setActivePage] = useState<Page>("home");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterAnim, setFilterAnim] = useState<FilterAnim>("collapsed");

  const showsFilter = activePage === "writing" || activePage === "vault";

  useEffect(() => {
    if (showsFilter) {
      setFilterAnim((prev) => prev === "collapsed" || prev === "collapsing" ? "expanding" : prev);
    } else {
      setFilterAnim((prev) => prev === "expanded" || prev === "expanding" ? "collapsing" : prev);
    }
  }, [showsFilter]);

  const handleAnimationEnd = () => {
    setFilterAnim((prev) => {
      if (prev === "expanding") return "expanded";
      if (prev === "collapsing") return "collapsed";
      return prev;
    });
  };

  const containerStyle = (): React.CSSProperties => {
    switch (filterAnim) {
      case "collapsed":  return { maxWidth: "0px", overflow: "hidden" };
      case "expanding":  return { animation: "filter-expand 350ms cubic-bezier(0.24,0.69,0.45,0.94) forwards", overflow: "hidden" };
      case "expanded":   return { maxWidth: `${FILTER_WIDTH}px`, overflow: "visible" };
      case "collapsing": return { animation: "filter-collapse 325ms cubic-bezier(0.24,0.69,0.43,1) forwards", overflow: "hidden" };
    }
  };

  const iconVisible = filterAnim === "expanding" || filterAnim === "expanded";

  const handleNavMouseLeave = () => {
    resetTimerRef.current = setTimeout(() => setTooltipsReady(false), 300);
  };

  const handleNavMouseEnter = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const sharedProps = { tooltipsReady, onTooltipShown: () => setTooltipsReady(true) };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2" onMouseEnter={handleNavMouseEnter} onMouseLeave={handleNavMouseLeave}>
      <div className="flex items-center rounded-full border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm overflow-visible">
        <NavButton icon={HomeIcon} label="Home" active={activePage === "home"} onClick={() => setActivePage("home")} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <NavButton icon={JournalIcon} label="Writing" active={activePage === "writing"} onClick={() => setActivePage("writing")} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <NavButton icon={GridIcon} label="Vault" active={activePage === "vault"} onClick={() => setActivePage("vault")} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <div className="mx-1 h-6 w-px bg-gray-200 shrink-0" />

        <div
          className="shrink-0"
          style={containerStyle()}
          onAnimationEnd={handleAnimationEnd}
        >
          <div className="flex items-center">
            <div className="w-3 shrink-0" />
            <div
              style={{
                opacity: iconVisible ? 1 : 0,
                filter: iconVisible ? "blur(0px)" : "blur(4px)",
                transform: iconVisible ? "scale(1)" : "scale(0.85)",
                transition: "opacity 225ms ease-out, filter 225ms ease-out, transform 225ms ease-out",
              }}
            >
              <NavButton icon={FilterIcon} label="Filter" {...sharedProps} />
            </div>
            <div className="w-3 shrink-0" />
            <div className="mx-1 h-6 w-px bg-gray-200 shrink-0" />
          </div>
        </div>

        <div className="w-3 shrink-0" />
        <NavButton icon={isDark ? SunIcon : MoonIcon} label={isDark ? "Light mode" : "Dark mode"} iconKey={isDark ? "sun" : "moon"} iconAnimation={isDark ? "animate-icon-enter-sunrise" : "animate-icon-enter-sunset"} onClick={() => setIsDark(!isDark)} {...sharedProps} />
        <div className="w-3 shrink-0" />
        <NavButton icon={MailIcon} label="Email" href="mailto:christopher.apramana@gmail.com" {...sharedProps} />
        <div className="w-3 shrink-0" />
        <div className="w-2 shrink-0" />
        <MusicPlayer />
      </div>
    </div>
  );
}
