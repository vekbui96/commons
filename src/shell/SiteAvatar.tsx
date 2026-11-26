import { useState } from "react";
import { useProfile } from "@/profiles/useProfile";
import { isPrivateSite } from "@/site";
import { ProfileDialog } from "./ProfileDialog";

export interface SiteAvatarProps {
  privateSite?: boolean;
  /** What the badge says on the public site ("Guest" or a visitor's name). */
  label?: string;
  /** The tap action. When set, the badge renders as a button; otherwise it is a plain label. */
  onActivate?: () => void;
}

/**
 * The round badge at the top right of the homepage: "Private" on the private
 * (tailnet-only) build; on the public one, "Guest" or the visitor's name.
 */
export function SiteAvatar({ privateSite = isPrivateSite(), label, onActivate }: SiteAvatarProps) {
  const text = privateSite ? "Private" : (label ?? "Guest");
  const title = privateSite
    ? "The private Commons, on the tailnet only"
    : onActivate
      ? "Who's visiting? Choose your view"
      : "The public Commons";
  const className = `site-avatar${privateSite ? " is-private" : ""}`;
  const body = <span className="site-avatar__label">{text}</span>;

  if (onActivate) {
    return (
      <button type="button" className={className} title={title} aria-haspopup="dialog" onClick={onActivate}>
        {body}
      </button>
    );
  }
  return (
    <span className={className} title={title}>
      {body}
    </span>
  );
}

/**
 * The homepage's avatar. Public build: shows the visitor's profile and opens
 * "Who's visiting?" on tap. Private build: the plain "Private" badge.
 */
export function ProfileAvatar() {
  const { active, label } = useProfile();
  const [open, setOpen] = useState(false);

  if (!active) return <SiteAvatar />;
  return (
    <>
      <SiteAvatar privateSite={false} label={label} onActivate={() => setOpen(true)} />
      {open && <ProfileDialog onClose={() => setOpen(false)} />}
    </>
  );
}
