"use client";

import React, { useState, useRef } from "react";

const iconProps = { width: 20, height: 20, strokeWidth: 2, color: "var(--color-primary)" };

interface NavButtonProps {
  icon: React.ElementType;
  label?: string;
  href?: string;
  active?: boolean;
  target?: string;
  rel?: string;
  onClick?: () => void;
  iconKey?: string;
  iconAnimation?: string;
  tooltipsReady: boolean;
  onTooltipShown: () => void;
}

export default function NavButton({ icon: Icon, label, href, active, onClick, iconKey, iconAnimation, target, rel, tooltipsReady, onTooltipShown }: NavButtonProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (tooltipsReady) {
      setVisible(true);
    } else {
      timerRef.current = setTimeout(() => {
        setVisible(true);
        onTooltipShown();
      }, 1500);
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  const className = "flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors";

  const el = href ? (
    <a href={href} className={className} target={target} rel={rel} aria-label={label}>
      <Icon {...iconProps} />
    </a>
  ) : (
    <button className={className} aria-label={label} onClick={onClick}>
      <span key={iconKey} className={`inline-flex${iconAnimation ? ` ${iconAnimation}` : ""}`}><Icon {...iconProps} /></span>
    </button>
  );

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {el}
      {active && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: "var(--color-secondary)" }} />
      )}
      {label && (
        <div className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-gray-900 text-white text-xs whitespace-nowrap transition-opacity pointer-events-none ${visible ? "opacity-100" : "opacity-0"}`}>
          {label}
        </div>
      )}
    </div>
  );
}
