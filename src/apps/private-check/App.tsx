import { useEffect, useState } from "react";
import { API_BASE, getHealth, getSession, type HealthResponse, type SessionResponse } from "@/api/client";
import { Card, NeedsApi } from "@/ui";
import { describeSessionError } from "./session";
import "./private-check.css";

type Loaded<T> = { state: "loading" } | { state: "ok"; value: T } | { state: "failed"; message: string };

function Facts() {
  const [health, setHealth] = useState<Loaded<HealthResponse>>({ state: "loading" });
  const [session, setSession] = useState<Loaded<SessionResponse>>({ state: "loading" });

  useEffect(() => {
    let live = true;
    getHealth(API_BASE).then(
      (value) => live && setHealth({ state: "ok", value }),
      () => live && setHealth({ state: "failed", message: "No answer from /api/health." }),
    );
    getSession(API_BASE).then(
      (value) => live && setSession({ state: "ok", value }),
      (err: unknown) => live && setSession({ state: "failed", message: describeSessionError(err) }),
    );
    return () => {
      live = false;
    };
  }, []);

  const pending = "…";
  return (
    <Card as="section" aria-label="Private API status">
      <dl className="private-check__facts" data-testid="private-check-facts">
        <dt>API</dt>
        <dd>
          {health.state === "loading"
            ? pending
            : health.state === "failed"
              ? health.message
              : health.value.ok
                ? "Answering"
                : "Answering, database down"}
        </dd>
        {health.state === "ok" && (
          <>
            <dt>Database</dt>
            <dd>
              {health.value.db === "ok" ? "OK" : "Error"}, schema{" "}
              <span className="num">{health.value.schemaVersion ?? "?"}</span>
            </dd>
            <dt>App routers</dt>
            <dd>{health.value.apps.length > 0 ? health.value.apps.join(", ") : "None yet"}</dd>
          </>
        )}
        <dt>You</dt>
        <dd data-testid="private-check-login">
          {session.state === "loading"
            ? pending
            : session.state === "failed"
              ? session.message
              : session.value.login}
        </dd>
      </dl>
    </Card>
  );
}

export default function PrivateCheckApp() {
  return (
    <div className="private-check">
      <p className="private-check__note">
        A test app that only exists on the private Commons. Nothing is saved.
      </p>
      <NeedsApi base={API_BASE}>
        <Facts />
      </NeedsApi>
    </div>
  );
}
