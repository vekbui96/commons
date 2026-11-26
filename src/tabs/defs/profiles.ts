import { defineTab } from "../types";

export default defineTab({
  id: "profiles",
  label: "Profiles",
  icon: "people",
  kind: "panel",
  load: () => import("@/profiles/editor/ProfilesEditor"),
  order: 30,
  visibility: "private",
});
