import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
}

/** A surface panel. Never put a Card inside another Card. */
export function Card({ as: Tag = "div", className, ...rest }: CardProps) {
  return <Tag className={cx("ui-card", className)} {...rest} />;
}
