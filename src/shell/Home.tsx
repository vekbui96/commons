import { useEffect, useMemo, useRef, useState } from "react";
import { appPath, listedApps, type RegisteredApp } from "@/registry/registry";
import { Input, ListRow, SiteMark, ThemeToggle } from "@/ui";
import "./home.css";

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

function matches(app: RegisteredApp, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { name, description } = app.manifest;
  return name.toLowerCase().includes(q) || description.toLowerCase().includes(q);
}

export function Home({ apps = listedApps() }: { apps?: RegisteredApp[] }) {
  const [query, setQuery] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => apps.filter((app) => matches(app, query)), [apps, query]);

  // "/" jumps to the filter, as on GitHub and most search UIs.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest(EDITABLE)) return;
      event.preventDefault();
      filterRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="home">
      <header className="home__intro">
        <h1 className="home__wordmark">Commons</h1>
        <SiteMark />
        <p className="home__lede">Small apps and utilities, made as they are needed.</p>
      </header>

      <main className="home__index">
        <h2 className="home__label" id="apps-heading">
          Apps <span className="num">{apps.length}</span>
        </h2>

        {apps.length > 0 && (
          <div className="home__filter">
            <label htmlFor="app-filter" className="visually-hidden">
              Filter apps
            </label>
            <Input
              ref={filterRef}
              id="app-filter"
              type="search"
              placeholder="Filter apps"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  setQuery("");
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="home__filter-key" aria-hidden="true">
              /
            </kbd>
          </div>
        )}

        {apps.length === 0 ? (
          <p className="home__empty">Nothing here yet.</p>
        ) : shown.length === 0 ? (
          <p className="home__empty">No apps match “{query.trim()}”.</p>
        ) : (
          <ul className="ui-list" aria-labelledby="apps-heading">
            {shown.map(({ manifest }) =>
              manifest.kind === "external" ? (
                <ListRow
                  key={manifest.id}
                  href={manifest.url}
                  title={manifest.name}
                  description={manifest.description}
                  icon={manifest.icon}
                  tint={manifest.tint}
                />
              ) : (
                <ListRow
                  key={manifest.id}
                  to={appPath(manifest.id)}
                  title={manifest.name}
                  description={manifest.description}
                  icon={manifest.icon}
                  tint={manifest.tint}
                />
              ),
            )}
          </ul>
        )}
      </main>

      <footer className="home__footer">
        <a href="https://github.com/vekbui96/commons" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
        <ThemeToggle />
      </footer>
    </div>
  );
}
