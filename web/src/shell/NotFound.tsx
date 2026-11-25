import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="app-page">
      <main className="app-page__body">
        <h1 className="app-page__title">Not here</h1>
        <p className="app-page__desc">There is no app at this address.</p>
        <p>
          <Link to="/" className="back-link">
            ← Back to Commons
          </Link>
        </p>
      </main>
    </div>
  );
}
