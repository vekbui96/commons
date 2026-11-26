import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/api/client";
import { listedApps, type RegisteredApp } from "@/registry/registry";
import { AppMark, Button, Field, Input, NeedsApi, Select, Toast, useToast } from "@/ui";
import { enabledAppIds, filterApps } from "../resolve";
import type { Profile, ProfilesConfig } from "../types";
import {
  deleteProfile,
  describeError,
  describeReason,
  exportUrl,
  getDraft,
  getPublishStatus,
  problemsOf,
  profileLink,
  publish,
  saveGuest,
  saveProfile,
  slugify,
  type DraftState,
  type PublishStatus,
} from "./api";
import "./profiles-editor.css";

/** The apps a profile can offer: public apps only (the private build lists every app). */
function publicApps(): RegisteredApp[] {
  return listedApps().filter((app) => app.manifest.visibility === "public");
}

function configOf(draft: Pick<DraftState, "guest" | "profiles">): ProfilesConfig {
  return { version: 1, guest: draft.guest, profiles: draft.profiles };
}

/** What a visitor with this profile (undefined: a guest) sees, in homepage order. */
function visibleApps(
  draft: Pick<DraftState, "guest" | "profiles">,
  profile: Profile | undefined,
  apps: readonly RegisteredApp[],
): RegisteredApp[] {
  const ids = apps.map((app) => app.manifest.id);
  return filterApps(apps, enabledAppIds(configOf(draft), profile, ids));
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export interface ProfilesEditorProps {
  /** Public apps a profile can offer. Default: from the registry. */
  apps?: RegisteredApp[];
  /** API base override (tests). */
  base?: string | null;
}

/**
 * The Profiles tab (private build): edit who sees which public apps on the
 * public Commons, preview it, and publish it. Tailoring, never access control.
 */
export default function ProfilesEditor({ apps, base }: ProfilesEditorProps) {
  return (
    <div className="pe">
      <NeedsApi base={base}>
        <Editor apps={apps ?? publicApps()} base={base} />
      </NeedsApi>
    </div>
  );
}

type View = { kind: "list" } | { kind: "profile"; id: string | null } | { kind: "guest" };

type PublishNote = { tone: "ok"; text: string } | { tone: "danger"; text: string; reload?: boolean } | null;

function Editor({ apps, base }: { apps: RegisteredApp[]; base?: string | null }) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [note, setNote] = useState<PublishNote>(null);
  const [publishing, setPublishing] = useState(false);
  const { show, toast } = useToast();

  const load = useCallback(() => {
    setLoadError(null);
    return Promise.all([getDraft(base ?? undefined), getPublishStatus(base ?? undefined)]).then(
      ([nextDraft, nextStatus]) => {
        setDraft(nextDraft);
        setStatus(nextStatus);
      },
      (error: unknown) => setLoadError(error),
    );
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = useCallback(
    async (profile: Profile) => {
      const link = profileLink(profile.id);
      try {
        await navigator.clipboard.writeText(link);
        show(`Copied ${profile.name}'s link`, "ok");
      } catch {
        show(`Couldn't copy. The link is ${link}`, "danger");
      }
    },
    [show],
  );

  async function onPublish() {
    if (!draft) return;
    setPublishing(true);
    setNote(null);
    try {
      const next = await publish(draft.revision, base ?? undefined);
      setStatus(next);
      setDraft((d) => (d ? { ...d, dirty: next.dirty } : d));
      const when = formatTime(next.lastPublished?.publishedAt);
      setNote({
        tone: "ok",
        text: next.unchanged
          ? `Already up to date${when ? ` (published ${when})` : ""}.`
          : `Published${when ? ` at ${when}` : ""}. The public site updates in a minute or two.`,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "revision_mismatch") {
        setNote({
          tone: "danger",
          text: "The profiles changed since this page loaded. Reload, check them, then publish.",
          reload: true,
        });
      } else if (error instanceof ApiError && error.code === "publish_failed") {
        setNote({
          tone: "danger",
          text: `Publishing failed: ${describeReason(error.body.reason, error.body.status)}`,
        });
      } else if (error instanceof ApiError && error.code === "publish_in_progress") {
        setNote({ tone: "danger", text: "Another publish is still running. Try again in a moment." });
      } else if (error instanceof ApiError && error.code === "publish_not_configured") {
        setStatus((s) => (s ? { ...s, configured: false } : s));
      } else {
        setNote({ tone: "danger", text: `Publishing failed: ${describeError(error)}` });
      }
    } finally {
      setPublishing(false);
    }
  }

  function afterEdit(next: DraftState, message: string) {
    setDraft(next);
    setNote(null);
    setView({ kind: "list" });
    show(message, "ok");
  }

  if (loadError) {
    return (
      <div className="pe-state" role="alert">
        <p>{describeError(loadError)}</p>
        <Button variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!draft || !status) {
    return (
      <p className="pe-state" role="status">
        Loading profiles…
      </p>
    );
  }

  return (
    <>
      {view.kind === "list" && (
        <>
          <PublishBar
            draft={draft}
            status={status}
            note={note}
            publishing={publishing}
            base={base}
            onPublish={() => void onPublish()}
            onReload={() => {
              setNote(null);
              void load();
            }}
          />
          <ProfileList
            draft={draft}
            apps={apps}
            onAdd={() => setView({ kind: "profile", id: null })}
            onEdit={(id) => setView({ kind: "profile", id })}
            onEditGuest={() => setView({ kind: "guest" })}
            onCopy={(p) => void copyLink(p)}
          />
          <ViewAs draft={draft} apps={apps} />
        </>
      )}
      {view.kind === "profile" && (
        <ProfileForm
          key={view.id ?? "new"}
          draft={draft}
          apps={apps}
          base={base}
          profile={draft.profiles.find((p) => p.id === view.id)}
          onSaved={(next, name) => afterEdit(next, `Saved ${name}`)}
          onDeleted={(next, name) => afterEdit(next, `Deleted ${name}`)}
          onCancel={() => setView({ kind: "list" })}
          onCopy={(p) => void copyLink(p)}
        />
      )}
      {view.kind === "guest" && (
        <GuestForm
          draft={draft}
          apps={apps}
          base={base}
          onSaved={(next) => afterEdit(next, "Saved the guest apps")}
          onCancel={() => setView({ kind: "list" })}
        />
      )}
      <Toast {...toast} duration={toast.tone === "danger" ? 8000 : 3000} />
    </>
  );
}

/* ---------- Publish ---------- */

function PublishBar({
  draft,
  status,
  note,
  publishing,
  base,
  onPublish,
  onReload,
}: {
  draft: DraftState;
  status: PublishStatus;
  note: PublishNote;
  publishing: boolean;
  base?: string | null;
  onPublish: () => void;
  onReload: () => void;
}) {
  const last = status.lastPublished;
  const when = formatTime(last?.publishedAt);
  return (
    <section className="pe-publish" aria-labelledby="pe-publish-title" data-testid="pe-publish">
      <div className="pe-publish__head">
        <h3 className="pe-publish__title" id="pe-publish-title">
          {draft.dirty ? (
            <span className="pe-dot pe-dot--warn" data-testid="pe-dirty">
              Unpublished changes
            </span>
          ) : (
            <span className="pe-dot pe-dot--ok">Published</span>
          )}
        </h3>
        {status.configured && (
          <Button onClick={onPublish} disabled={publishing || !draft.dirty}>
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        )}
      </div>

      {status.configured ? (
        <p className="pe-muted">
          {when ? `Last published ${when}. ` : "Not published from here yet. "}
          Changes reach the public site a minute or two after publishing.
        </p>
      ) : (
        <div className="pe-publish__fallback" data-testid="pe-not-configured">
          <p className="pe-muted">
            Publishing isn't set up yet (no GitHub token on the server). Download the file and commit it to
            the commons-profiles repo by hand; the public site picks it up a minute or two later.
          </p>
          <a
            className="ui-button ui-button--secondary"
            href={exportUrl(base ?? undefined)}
            download="profiles.json"
          >
            Download profiles.json
          </a>
        </div>
      )}

      {status.configured && !note && status.lastError && draft.dirty && (
        <p className="pe-note pe-note--danger">
          The last attempt failed: {describeReason(status.lastError.error, status.lastError.status)}
        </p>
      )}
      <div role="status" aria-live="polite">
        {note && (
          <div className={`pe-note pe-note--${note.tone}`} data-testid="pe-publish-note">
            <p>{note.text}</p>
            {note.tone === "danger" && note.reload && (
              <Button variant="secondary" onClick={onReload}>
                Reload
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- List ---------- */

function ProfileList({
  draft,
  apps,
  onAdd,
  onEdit,
  onEditGuest,
  onCopy,
}: {
  draft: DraftState;
  apps: RegisteredApp[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onEditGuest: () => void;
  onCopy: (profile: Profile) => void;
}) {
  const guestCount = visibleApps(draft, undefined, apps).length;
  return (
    <section className="pe-section" aria-labelledby="pe-list-title">
      <div className="pe-section__head">
        <h3 className="pe-heading" id="pe-list-title">
          Visitors <span className="num">{draft.profiles.length}</span>
        </h3>
        <Button variant="secondary" onClick={onAdd}>
          Add profile
        </Button>
      </div>
      <ul className="pe-list" data-testid="pe-list">
        <li className="pe-row">
          <div className="pe-row__text">
            <span className="pe-row__title">Guest</span>
            <span className="pe-row__desc">Anyone without a profile · {plural(guestCount, "app")}</span>
          </div>
          <div className="pe-row__actions">
            <Button variant="secondary" onClick={onEditGuest} aria-label="Edit Guest">
              Edit
            </Button>
          </div>
        </li>
        {draft.profiles.map((profile) => {
          const count = visibleApps(draft, profile, apps).length;
          const also = profile.aliases.length > 0 ? ` · also ${profile.aliases.join(", ")}` : "";
          return (
            <li className="pe-row" key={profile.id}>
              <div className="pe-row__text">
                <span className="pe-row__title">{profile.name}</span>
                <span className="pe-row__desc">
                  <span className="num">{profile.id}</span>
                  {also} · {plural(count, "app")}
                </span>
              </div>
              <div className="pe-row__actions">
                <Button
                  variant="secondary"
                  onClick={() => onCopy(profile)}
                  aria-label={`Copy ${profile.name}'s link`}
                >
                  Copy link
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onEdit(profile.id)}
                  aria-label={`Edit ${profile.name}`}
                >
                  Edit
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- View as ---------- */

function ViewAs({ draft, apps }: { draft: DraftState; apps: RegisteredApp[] }) {
  const [who, setWho] = useState("");
  const profile = draft.profiles.find((p) => p.id === who);
  const shown = visibleApps(draft, profile, apps);
  return (
    <section className="pe-section" aria-labelledby="pe-viewas-title">
      <h3 className="pe-heading" id="pe-viewas-title">
        View as
      </h3>
      <Field label="Visitor" hint="The tiles this visitor sees on the public homepage, from the draft.">
        <Select value={profile ? profile.id : ""} onChange={(e) => setWho(e.target.value)}>
          <option value="">Guest</option>
          {draft.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Tiles apps={shown} testId="pe-viewas" />
    </section>
  );
}

function Tiles({ apps, testId }: { apps: RegisteredApp[]; testId: string }) {
  if (apps.length === 0) {
    return (
      <p className="pe-muted" data-testid={testId}>
        No apps: the homepage says “Nothing here yet.”
      </p>
    );
  }
  return (
    <ul className="pe-tiles" data-testid={testId}>
      {apps.map(({ manifest }) => (
        <li className="pe-tile" key={manifest.id}>
          <AppMark icon={manifest.icon} tint={manifest.tint} />
          <span className="pe-tile__name">{manifest.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Forms ---------- */

function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

function Problems({ problems, message }: { problems: string[]; message: string | null }) {
  if (problems.length === 0 && !message) return null;
  return (
    <div className="pe-note pe-note--danger" role="alert" data-testid="pe-problems">
      {message && <p>{message}</p>}
      {problems.length > 0 && (
        <ul className="pe-problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppChecklist({
  apps,
  selected,
  onToggle,
  legend,
}: {
  apps: RegisteredApp[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  legend: string;
}) {
  return (
    <fieldset className="pe-fieldset">
      <legend className="pe-legend">{legend}</legend>
      <ul className="pe-checks">
        {apps.map(({ manifest }) => (
          <li key={manifest.id}>
            <label className="pe-check">
              <input
                type="checkbox"
                checked={selected.has(manifest.id)}
                onChange={() => onToggle(manifest.id)}
              />
              <span className="pe-check__text">
                <span className="pe-check__name">{manifest.name}</span>
                <span className="pe-check__desc">{manifest.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** App ids in registry order, keeping ids the registry does not know (they stay saved). */
function orderedIds(selected: ReadonlySet<string>, apps: RegisteredApp[]): string[] {
  const known = apps.map((a) => a.manifest.id).filter((id) => selected.has(id));
  const unknown = [...selected].filter((id) => !apps.some((a) => a.manifest.id === id));
  return [...known, ...unknown];
}

function ProfileForm({
  draft,
  apps,
  base,
  profile,
  onSaved,
  onDeleted,
  onCancel,
  onCopy,
}: {
  draft: DraftState;
  apps: RegisteredApp[];
  base?: string | null;
  profile: Profile | undefined;
  onSaved: (next: DraftState, name: string) => void;
  onDeleted: (next: DraftState, name: string) => void;
  onCancel: () => void;
  onCopy: (profile: Profile) => void;
}) {
  const isNew = !profile;
  const [name, setName] = useState(profile?.name ?? "");
  const [idText, setIdText] = useState(profile?.id ?? "");
  const [idTouched, setIdTouched] = useState(false);
  const [aliasesText, setAliasesText] = useState(profile?.aliases.join(", ") ?? "");
  const [inheritsGuest, setInheritsGuest] = useState(profile?.inheritsGuest ?? true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(profile?.apps ?? []));
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const switchId = useId();

  const id = isNew ? (idTouched ? idText.trim() : slugify(name)) : profile.id;
  const aliases = aliasesText
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const preview: Profile = { id: id || "new", name, aliases, inheritsGuest, apps: [...selected] };
  const effective = visibleApps(draft, preview, apps);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblems([]);
    setMessage(null);
    if (!id) {
      setProblems(["Add a name (or a link name) first."]);
      return;
    }
    if (isNew && draft.profiles.some((p) => p.id === id)) {
      setProblems([`The link name “${id}” is already used. Pick another.`]);
      return;
    }
    setBusy(true);
    try {
      const next = await saveProfile(
        id,
        { name: name.trim(), aliases, inheritsGuest, apps: orderedIds(selected, apps) },
        base ?? undefined,
      );
      onSaved(next, name.trim());
    } catch (error) {
      const found = problemsOf(error);
      setProblems(found);
      if (found.length === 0) setMessage(`Couldn't save: ${describeError(error)}`);
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    try {
      onDeleted(await deleteProfile(profile.id, base ?? undefined), profile.name);
    } catch (error) {
      setMessage(`Couldn't delete: ${describeError(error)}`);
      setConfirming(false);
      setBusy(false);
    }
  }

  return (
    <form className="pe-form" onSubmit={(e) => void onSubmit(e)} noValidate data-testid="pe-form">
      <div className="pe-form__head">
        <button type="button" className="pe-back" onClick={onCancel}>
          <span aria-hidden="true">←</span> All profiles
        </button>
        <h3 className="pe-form__title" ref={headingRef} tabIndex={-1}>
          {isNew ? "New profile" : `Edit ${profile.name}`}
        </h3>
      </div>

      <Field label="Name" hint="A plain first name. It shows on the avatar.">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={40} />
      </Field>

      {isNew ? (
        <Field label="Link name" hint={`Used in the link: ${profileLink(id || "…")}. Fixed once saved.`}>
          <Input
            className="num"
            value={id}
            onChange={(e) => {
              setIdTouched(true);
              setIdText(e.target.value);
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={32}
          />
        </Field>
      ) : (
        <div className="pe-link">
          <p className="pe-muted">
            Link: <span className="num">{profileLink(profile.id)}</span>
          </p>
          <Button variant="secondary" onClick={() => onCopy(profile)}>
            Copy link
          </Button>
        </div>
      )}

      <Field label="Other names" hint="Nicknames that also pick this profile, separated by commas.">
        <Input value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} autoComplete="off" />
      </Field>

      <label className="pe-switch" htmlFor={switchId}>
        <span className="pe-check__text">
          <span className="pe-check__name">Includes guest apps</span>
          <span className="pe-check__desc">Also sees what a guest sees.</span>
        </span>
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          className="pe-switch__control"
          checked={inheritsGuest}
          onChange={(e) => setInheritsGuest(e.target.checked)}
        />
      </label>

      <AppChecklist
        legend="Apps"
        apps={apps}
        selected={selected}
        onToggle={(appId) => setSelected((s) => toggled(s, appId))}
      />

      <section className="pe-effective" aria-labelledby="pe-effective-title">
        <h4 className="pe-legend" id="pe-effective-title">
          {name.trim() ? `${name.trim()} sees` : "This profile sees"}{" "}
          <span className="num">{effective.length}</span>
        </h4>
        <Tiles apps={effective} testId="pe-effective" />
      </section>

      <Problems problems={problems} message={message} />

      <div className="pe-actions">
        <Button type="submit" disabled={busy}>
          {busy && !confirming ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {!isNew && !confirming && (
          <Button
            variant="secondary"
            className="pe-actions__end"
            onClick={() => setConfirming(true)}
            disabled={busy}
          >
            Delete…
          </Button>
        )}
      </div>

      {!isNew && confirming && (
        <div className="pe-confirm" role="alertdialog" aria-labelledby="pe-confirm-text">
          <p id="pe-confirm-text">Delete {profile.name}? Their link stops working once you publish.</p>
          <div className="pe-actions">
            <Button variant="danger" onClick={() => void onDelete()} disabled={busy}>
              {busy ? "Deleting…" : `Delete ${profile.name}`}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy} autoFocus>
              Keep
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function GuestForm({
  draft,
  apps,
  base,
  onSaved,
  onCancel,
}: {
  draft: DraftState;
  apps: RegisteredApp[];
  base?: string | null;
  onSaved: (next: DraftState) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(draft.guest.apps));
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const effective = useMemo(
    () => visibleApps({ guest: { apps: [...selected] }, profiles: [] }, undefined, apps),
    [selected, apps],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblems([]);
    setMessage(null);
    setBusy(true);
    try {
      onSaved(await saveGuest(orderedIds(selected, apps), base ?? undefined));
    } catch (error) {
      const found = problemsOf(error);
      setProblems(found);
      if (found.length === 0) setMessage(`Couldn't save: ${describeError(error)}`);
      setBusy(false);
    }
  }

  return (
    <form className="pe-form" onSubmit={(e) => void onSubmit(e)} noValidate data-testid="pe-guest-form">
      <div className="pe-form__head">
        <button type="button" className="pe-back" onClick={onCancel}>
          <span aria-hidden="true">←</span> All profiles
        </button>
        <h3 className="pe-form__title" ref={headingRef} tabIndex={-1}>
          Edit Guest
        </h3>
      </div>
      <p className="pe-muted">
        What anyone without a profile sees. A new public app stays hidden until it is ticked here or in a
        profile. Guest can't be deleted.
      </p>
      <AppChecklist
        legend="Apps"
        apps={apps}
        selected={selected}
        onToggle={(appId) => setSelected((s) => toggled(s, appId))}
      />
      <section className="pe-effective" aria-labelledby="pe-guest-effective-title">
        <h4 className="pe-legend" id="pe-guest-effective-title">
          A guest sees <span className="num">{effective.length}</span>
        </h4>
        <Tiles apps={effective} testId="pe-effective" />
      </section>
      <Problems problems={problems} message={message} />
      <div className="pe-actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
