import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** A 44px-tall button. Primary is the one main action on a screen. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", type = "button", className, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx("ui-button", `ui-button--${variant}`, className)} {...rest} />
  );
});
