import { defineApp } from "@/registry/types";

export default defineApp({
  id: "server-map",
  name: "Server map",
  description: "A live map of server-pc: what runs, what reaches it, and how it fits together.",
  icon: "⌗",
  tint: "steel",
  kind: "internal",
  visibility: "private",
  wide: true,
});
