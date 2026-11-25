import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cx } from "./cx";

/** Text input. Font size stays >= 16px so iOS does not zoom on focus. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx("ui-input", className)} {...rest} />;
});

/** Native select with a themed chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...rest },
  ref,
) {
  return (
    <span className={cx("ui-select", className)}>
      <select ref={ref} className="ui-input ui-select__control" {...rest} />
    </span>
  );
});
