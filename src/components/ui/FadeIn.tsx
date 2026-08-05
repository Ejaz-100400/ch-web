import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

/** Re-triggers the fade-in-up CSS animation on every route change by keying on the pathname. */
export function FadeIn({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="fade-in-up">
      {children}
    </div>
  );
}
