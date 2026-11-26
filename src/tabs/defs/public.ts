import { defineTab } from "../types";

export default defineTab({
  id: "public",
  label: "Public",
  icon: "globe",
  kind: "apps",
  filter: { appVisibility: "public" },
  order: 10,
  visibility: "public",
});
