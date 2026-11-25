import { Link } from "react-router-dom";
import { appPath, listedApps, type RegisteredApp } from "@/registry/registry";

function AppEntry({ app }: { app: RegisteredApp }) {
  const { manifest } = app;
  const body = (
    <>
      <span className="entry__mark" aria-hidden="true">
        {manifest.icon}
      </span>
      <span className="entry__text">
        <span className="entry__name">{manifest.name}</span>
        <span className="entry__desc">{manifest.description}</span>
      </span>
      <span className="entry__arrow" aria-hidden="true">
        {manifest.kind === "external" ? "↗" : "→"}
      </span>
    </>
  );

  return (
    <li className="entry" data-app-id={manifest.id}>
      {manifest.kind === "external" ? (
        <a className="entry__link" href={manifest.url} target="_blank" rel="noopener noreferrer">
          {body}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      ) : (
        <Link className="entry__link" to={appPath(manifest.id)}>
          {body}
        </Link>
      )}
    </li>
  );
}

export function Home({ apps = listedApps() }: { apps?: RegisteredApp[] }) {
  return (
    <div className="home">
      <header className="home__intro">
        <h1 className="wordmark">Commons</h1>
        <p className="home__lede">Small apps and utilities, made as they are needed.</p>
      </header>

      <main className="home__index">
        <h2 className="section-label" id="apps-heading">
          Apps <span className="section-label__count">{apps.length}</span>
        </h2>
        {apps.length === 0 ? (
          <p className="empty">Nothing here yet.</p>
        ) : (
          <ul className="entries" aria-labelledby="apps-heading">
            {apps.map((app) => (
              <AppEntry key={app.manifest.id} app={app} />
            ))}
          </ul>
        )}
      </main>

      <footer className="home__footer">
        <a href="https://github.com/vekbui96/commons" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
