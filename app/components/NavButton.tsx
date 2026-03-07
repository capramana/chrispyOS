"use client";

import React, { useState, useRef, useEffect } from "react";
import "./NavButton.css";

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
  const [ExitingIcon, setExitingIcon] = useState<React.ElementType | null>(null);
  const [exitAnimation, setExitAnimation] = useState("");
  const prevIconRef = useRef(Icon);

  useEffect(() => {
    if (prevIconRef.current !== Icon && iconAnimation) {
      const exiting = prevIconRef.current;
      const exitAnim = iconAnimation === "animate-icon-enter-sunrise" ? "animate-icon-exit-sunrise" : "animate-icon-exit-sunset";
      setExitingIcon(() => exiting);
      setExitAnimation(exitAnim);
      prevIconRef.current = Icon;
      const timer = setTimeout(() => setExitingIcon(null), 250);
      return () => clearTimeout(timer);
    }
    prevIconRef.current = Icon;
  }, [Icon, iconAnimation]);

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

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    timerRef.current = setTimeout(() => {
      setVisible(true);
      onTooltipShown();
    }, 1500);
  };

  const buttonClass = "flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors";

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="relative h-10 w-10 overflow-hidden rounded-full">
        {href ? (
          <a href={href} className={buttonClass} target={target} rel={rel} aria-label={label}>
            <Icon {...iconProps} />
          </a>
        ) : (
          <>
            <button className={buttonClass} aria-label={label} onClick={() => { onClick?.(); handleClick(); }} />
            {ExitingIcon && (
              <span className={`absolute inset-0 flex items-center justify-center pointer-events-none ${exitAnimation}`}>
                <ExitingIcon {...iconProps} />
              </span>
            )}
            <span key={iconKey} className={`absolute inset-0 flex items-center justify-center pointer-events-none${iconAnimation ? ` ${iconAnimation}` : ""}`}>
              <Icon {...iconProps} />
            </span>
          </>
        )}
      </div>
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
