import { defineApp } from "@/registry/types";

export default defineApp({
  id: "units",
  name: "Units",
  description: "Quick conversions: length, weight and temperature.",
  icon: "⇄",
  tint: "cobalt",
  kind: "internal",
  visibility: "public",
});
