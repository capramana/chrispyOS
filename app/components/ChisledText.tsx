import "./ChisledText.css";

interface ChisledTextProps {
  children: React.ReactNode;
  sub?: boolean;
}

export default function ChisledText({ children, sub = false }: ChisledTextProps) {
  return (
    <span className={sub ? "text-chromed-sub" : "text-chromed"}>
      {children}
    </span>
  );
}
