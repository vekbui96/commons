import { defineTab } from "../types";

// The ops hub dashboard, mounted live from the hub's own build on this origin
// (src/shell/ops/, docs/ops-hub-contract.md).
export default defineTab({
  id: "ops",
  label: "Ops",
  icon: "pulse",
  kind: "panel",
  load: () => import("@/shell/ops/OpsPanel"),
  order: 25,
  visibility: "private",
});
