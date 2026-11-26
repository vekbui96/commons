import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { findInternalApp, listedApps, appPath, type RegisteredApp } from "@/registry/registry";
import { appsForTab, availableTabs, resolveTab, tabPath, type SelectableTab } from "@/tabs/registry";
import type { AppsTab, PageTab, TabDefinition } from "@/tabs/types";
import { useProfile } from "@/profiles/useProfile";
import { ListRow, ThemeToggle } from "@/ui";
import { lazyFor } from "./lazyApp";
import { fromTab, tabDomId } from "./navState";
import { ProfileAvatar } from "./SiteAvatar";
import { TabCarousel } from "./TabCarousel";
import "./home.css";

const PANEL_ID = "home-tabpanel";

/** True once the page has scrolled, so the sticky header can show its edge. */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}

/** A tab that shows one app (a page, or a link to `#/apps/<id>`) needs that app enabled. */
function tabEnabled(tab: TabDefinition, isEnabled: (appId: string) => boolean): boolean {
  if (tab.kind === "page") return isEnabled(tab.app);
  if (tab.kind === "link") {
    const match = /^#\/apps\/([a-z0-9-]+)/.exec(tab.url);
    return match ? isEnabled(match[1]!) : true;
  }
  return true;
}

export interface HomeProps {
  apps?: RegisteredApp[];
  tabs?: TabDefinition[];
}

/**
 * The homepage: a sticky header (the "Commons" pill, the site avatar and the
 * tab carousel), then the selected tab's content. The page itself scrolls
 * under the header. The selected tab lives in the URL: `#/tab/<id>`, `#/` for
 * the default.
 */
// This build's apps and tabs never change at runtime: work them out once.
const BUILD_APPS = listedApps();
const BUILD_TABS = availableTabs();

export function Home({ apps: allApps = BUILD_APPS, tabs: allTabs = BUILD_TABS }: HomeProps) {
  // The visitor's profile narrows what this build offers (public build only).
  const profile = useProfile();
  const apps = useMemo(() => profile.filterApps(allApps), [profile, allApps]);
  const tabs = useMemo(() => allTabs.filter((t) => tabEnabled(t, profile.isEnabled)), [profile, allTabs]);
  const { tabId } = useParams();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const tab = resolveTab(tabId, tabs);
  const here = tab ? tabPath(tab.id, tabs) : "/";

  // An unknown tab id falls back to the default; make the URL say so.
  useEffect(() => {
    if (tabId !== undefined && tab?.id !== tabId) navigate(here, { replace: true });
  }, [tabId, tab, here, navigate]);

  // A new tab starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab?.id]);

  function select(next: SelectableTab) {
    const path = tabPath(next.id, tabs);
    if (path !== here) navigate(path);
  }

  return (
    <div className="home">
      <header className="home-header" data-scrolled={scrolled || undefined}>
        <div className="home-header__inner">
          <div className="home-header__bar">
            <h1 className="home-pill">
              <Link to="/" className="home-pill__link">
                Commons
              </Link>
            </h1>
            <ProfileAvatar />
          </div>
          {tabs.length > 0 && (
            <TabCarousel tabs={tabs} selectedId={tab?.id} onSelect={select} panelId={PANEL_ID} />
          )}
        </div>
      </header>

      <main className="home__main">
        {tab ? (
          <section
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={tabDomId(tab.id)}
            className="home__panel"
            tabIndex={-1}
          >
            {tab.kind === "apps" ? (
              <AppsPanel tab={tab} apps={appsForTab(tab, apps)} from={here} />
            ) : (
              <PagePanel tab={tab} />
            )}
          </section>
        ) : (
          <p className="home__empty">Nothing here yet.</p>
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

function AppsPanel({ tab, apps, from }: { tab: AppsTab; apps: RegisteredApp[]; from: string }) {
  const headingId = `${PANEL_ID}-heading`;
  return (
    <>
      <h2 className="home__label" id={headingId}>
        {tab.label} <span className="num">{apps.length}</span>
      </h2>
      {apps.length === 0 ? (
        <p className="home__empty">Nothing here yet.</p>
      ) : (
        <ul className="ui-list" aria-labelledby={headingId}>
          {apps.map(({ manifest }) =>
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
                state={fromTab(from)}
                title={manifest.name}
                description={manifest.description}
                icon={manifest.icon}
                tint={manifest.tint}
              />
            ),
          )}
        </ul>
      )}
    </>
  );
}

function PagePanel({ tab }: { tab: PageTab }) {
  const app = findInternalApp(tab.app);
  const Component = app ? lazyFor(app) : null;
  if (!Component) return <p className="home__empty">Nothing here yet.</p>;
  return (
    <>
      <h2 className="visually-hidden">{tab.label}</h2>
      <Suspense fallback={<p className="loading">Loading…</p>}>
        <Component />
      </Suspense>
    </>
  );
}
