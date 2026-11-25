import { useEffect } from "react";
import { cx } from "./cx";

export type ToastTone = "neutral" | "ok" | "warn" | "danger";

export interface ToastProps {
  message: string | null;
  tone?: ToastTone;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms (0 keeps it until dismissed). */
  duration?: number;
}

/**
 * A short status message at the bottom of the screen. The live region stays
 * mounted so screen readers announce each new message. See useToast().
 */
export function Toast({ message, tone = "neutral", onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!message || duration === 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <div className="ui-toast-region" role="status" aria-live="polite">
      {message && (
        <div className={cx("ui-toast", `ui-toast--${tone}`)}>
          <span className="ui-toast__message">{message}</span>
          <button type="button" className="ui-toast__close" onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
