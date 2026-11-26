import { isPrivateSite } from "@/site";

export interface SiteAvatarProps {
  privateSite?: boolean;
  /**
   * The future tap action (e.g. show the Tailscale sign-in). When set, the
   * badge renders as a button; until then it is a plain label.
   */
  onActivate?: () => void;
}

/**
 * The round badge at the top right of the homepage: "Private" on the private
 * (tailnet-only) build, "Guest" on the public one. Label only for now.
 */
export function SiteAvatar({ privateSite = isPrivateSite(), onActivate }: SiteAvatarProps) {
  const label = privateSite ? "Private" : "Guest";
  const title = privateSite ? "The private Commons, on the tailnet only" : "The public Commons";
  const className = `site-avatar${privateSite ? " is-private" : ""}`;

  if (onActivate) {
    return (
      <button type="button" className={className} title={title} onClick={onActivate}>
        {label}
      </button>
    );
  }
  return (
    <span className={className} title={title}>
      {label}
    </span>
  );
}
