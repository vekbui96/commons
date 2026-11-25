import { useCallback, useState } from "react";
import type { ToastProps, ToastTone } from "./Toast";

/** State for one <Toast>: `show("Copied")`, then spread `toast` onto <Toast>. */
export function useToast() {
  const [state, setState] = useState<{ message: string | null; tone: ToastTone }>({
    message: null,
    tone: "neutral",
  });
  const onDismiss = useCallback(() => setState((s) => ({ ...s, message: null })), []);
  const show = useCallback((message: string, tone: ToastTone = "neutral") => setState({ message, tone }), []);
  const toast: ToastProps = { ...state, onDismiss };
  return { show, toast };
}
