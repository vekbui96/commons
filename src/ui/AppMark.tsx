import { DEFAULT_TINT, type AppTint } from "./tints";

/** An app's icon tile: one or two characters on its tint. */
export function AppMark({ icon, tint = DEFAULT_TINT }: { icon: string; tint?: AppTint }) {
  return (
    <span className={`ui-mark ui-mark--${tint}`} aria-hidden="true">
      {icon}
    </span>
  );
}
