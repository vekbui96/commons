import { defineApp } from "@/registry/types";

export default defineApp({
  id: "units",
  name: "Units",
  description: "Quick conversions: length, weight and temperature.",
  icon: "⇄",
  kind: "internal",
  visibility: "public",
});
