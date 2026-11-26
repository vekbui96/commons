import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppMark } from "./AppMark";
import type { AppTint } from "./tints";

type Target = { to: string; state?: unknown; href?: never } | { href: string; to?: never; state?: never };

export type ListRowProps = Target & {
  title: ReactNode;
  description?: ReactNode;
  /** One or two characters, shown in a tinted tile. */
  icon?: string;
  tint?: AppTint;
};

/**
 * One tappable row in a list (put it inside a <ul className="ui-list">).
 * `to` is a route inside Commons (with optional router `state`); `href` opens
 * in a new tab.
 */
export function ListRow({ title, description, icon, tint, state, ...target }: ListRowProps) {
  const external = target.href !== undefined;
  const body = (
    <>
      {icon !== undefined && <AppMark icon={icon} tint={tint} />}
      <span className="ui-listrow__text">
        <span className="ui-listrow__title">{title}</span>
        {description && <span className="ui-listrow__desc">{description}</span>}
      </span>
      <span className="ui-listrow__arrow" aria-hidden="true">
        {external ? "↗" : "→"}
      </span>
    </>
  );

  return (
    <li className="ui-listrow">
      {external ? (
        <a className="ui-listrow__link" href={target.href} target="_blank" rel="noopener noreferrer">
          {body}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      ) : (
        <Link className="ui-listrow__link" to={target.to!} state={state}>
          {body}
        </Link>
      )}
    </li>
  );
}
