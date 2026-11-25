import { defineApp } from "@/registry/types";

export default defineApp({
  id: "private-check",
  name: "Private check (test)",
  description: "Shows whether the private API answers and who you are on the tailnet.",
  icon: "◎",
  tint: "slate",
  kind: "internal",
  visibility: "private",
});
