import { useState } from "react";
import { readTheme, saveTheme, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Light / dark / system switch; the choice is remembered on this device. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>(readTheme);

  return (
    <div className="ui-segmented" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className="ui-segmented__option"
          aria-pressed={pref === value}
          onClick={() => {
            setPref(value);
            saveTheme(value);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
