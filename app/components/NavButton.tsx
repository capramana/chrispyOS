import React from "react";

const iconProps = { width: 20, height: 20, strokeWidth: 2, color: "var(--color-primary)" };

interface NavButtonProps {
  icon: React.ElementType;
  href?: string;
  active?: boolean;
  target?: string;
  rel?: string;
}

export default function NavButton({ icon: Icon, href, active, target, rel }: NavButtonProps) {
  const className = "flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors";

  const el = href ? (
    <a href={href} className={className} target={target} rel={rel}>
      <Icon {...iconProps} />
    </a>
  ) : (
    <button className={className}><Icon {...iconProps} /></button>
  );

  if (!active) return el;

  return (
    <div className="relative">
      {el}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: "var(--color-secondary)" }} />
    </div>
  );
}
