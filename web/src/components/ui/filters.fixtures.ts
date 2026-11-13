import type { FilterDef } from "@/components/ui/filters";

/** One of each kind, shared by the filter tests. */
export const defs: FilterDef[] = [
  {
    id: "status",
    kind: "segmented",
    label: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "pending", label: "Pending" },
      { value: "bounced", label: "Bounced" },
    ],
  },
  {
    id: "lang",
    kind: "segmented",
    label: "Language",
    options: [
      { value: "en", label: "EN" },
      { value: "he", label: "עב" },
    ],
  },
  {
    id: "group",
    kind: "multi",
    label: "Group",
    options: [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
      { value: "c", label: "Gamma" },
    ],
  },
  {
    id: "created",
    kind: "range",
    label: "Signed up",
    presets: [{ label: "Last 7 days", from: "2026-11-07", to: "2026-11-14" }],
  },
  {
    id: "sort",
    kind: "sort",
    label: "Sort by",
    options: [
      { value: "new", label: "Newest" },
      { value: "name", label: "Name" },
    ],
  },
];
