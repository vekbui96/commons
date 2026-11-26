import { defineTab } from "../types";

export default defineTab({
  id: "private",
  label: "Private",
  icon: "lock",
  kind: "apps",
  filter: { appVisibility: "private" },
  order: 20,
  visibility: "private",
});
