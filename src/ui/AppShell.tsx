import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cx } from "./cx";
import { SiteMark } from "./SiteMark";

export interface AppShellProps {
  /** The app name, shown in the top bar as the page's h1. */
  title: string;
  /** One line under the top bar. */
  description?: ReactNode;
  /** ~1100px content column instead of ~680px. */
  wide?: boolean;
  /** Where "← Commons" and Esc go: the homepage tab the user came from (default "/"). */
  backTo?: string;
  children: ReactNode;
}

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/**
 * The frame every internal app sits in: a top bar with "← Commons" and the app
 * name, then one content column. Esc goes back to Commons (inside a text field
 * it first leaves the field).
 */
export function AppShell({ title, description, wide = false, backTo = "/", children }: AppShellProps) {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest(EDITABLE)) {
        target.blur();
        return;
      }
      navigate(backTo);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, backTo]);

  return (
    <div className="ui-shell">
      <header className="ui-topbar">
        <div className={cx("ui-topbar__inner", wide && "is-wide")}>
          <Link to={backTo} className="ui-topbar__back">
            <span aria-hidden="true">←</span> Commons
          </Link>
          <h1 className="ui-topbar__title">{title}</h1>
          <SiteMark />
        </div>
      </header>
      <main className={cx("ui-column", wide && "is-wide")}>
        {description && <p className="ui-shell__lede">{description}</p>}
        {children}
      </main>
    </div>
  );
}
