import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useProfile } from "@/profiles/useProfile";
import { Button, Field, Input } from "@/ui";
import "./profile-dialog.css";

export interface ProfileDialogProps {
  /** Called on Cancel, Escape, a click on the backdrop, or once a choice is made. */
  onClose: () => void;
}

/**
 * "Who's visiting?": a native modal <dialog> for picking a visitor profile by
 * first name (public build only). Mount it to open it; focus goes to the name
 * box (or "Switch to guest") and returns to where it was on close.
 */
export function ProfileDialog({ onClose }: ProfileDialogProps) {
  const { profile, choose, switchToGuest } = useProfile();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstRef = useRef<HTMLInputElement & HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [missed, setMissed] = useState<string>();
  const titleId = useId();
  const noteId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    firstRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      returnTo?.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  // A click on the dialog element itself (not its content) is on the backdrop.
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const typed = name.trim();
    if (!typed) return;
    if (choose(typed)) onClose();
    else setMissed(typed);
  }

  return (
    <dialog
      ref={dialogRef}
      className="profile-dialog"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={onClick}
    >
      <div className="profile-dialog__body">
        {profile ? (
          <>
            <h2 className="profile-dialog__title" id={titleId}>
              Browsing as {profile.name}
            </h2>
            <p className="profile-dialog__text">You see the apps picked for you.</p>
            <div className="profile-dialog__actions">
              <Button
                ref={firstRef}
                onClick={() => {
                  switchToGuest();
                  onClose();
                }}
              >
                Switch to guest
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <form className="profile-dialog__form" onSubmit={onSubmit} autoComplete="off">
            <h2 className="profile-dialog__title" id={titleId}>
              Who&rsquo;s visiting?
            </h2>
            <Field label="First name">
              <Input
                ref={firstRef}
                name="visitor"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setMissed(undefined);
                }}
                autoComplete="off"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                data-1p-ignore=""
                data-lpignore="true"
                aria-describedby={missed ? noteId : undefined}
              />
            </Field>
            <p className="profile-dialog__note" id={noteId} role="status">
              {missed ? <>No view for &ldquo;{missed}&rdquo; yet. You&rsquo;re browsing as a guest.</> : null}
            </p>
            <div className="profile-dialog__actions">
              <Button type="submit">Continue</Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
