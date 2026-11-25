import { isPrivateSite } from "@/site";

/**
 * A small "Private" label, shown only on the private (tailnet-only) build so
 * it is obvious which Commons you are on. Renders nothing on the public site.
 */
export function SiteMark({ privateSite = isPrivateSite() }: { privateSite?: boolean }) {
  if (!privateSite) return null;
  return (
    <span className="ui-site-mark" title="The private Commons, on the tailnet only">
      Private
    </span>
  );
}
