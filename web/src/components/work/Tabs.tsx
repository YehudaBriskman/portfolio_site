import styles from "@/components/work/Tabs.module.css";
import { count as fmt, useLang } from "@/components/dashboard/i18n";
import { panelId, tabId } from "@/components/work/order";
import SegmentedTabs, { type TabSpec } from "@/components/phone/SegmentedTabs";

/*
 * A repository's tabs (#227): GitHub's underline nav on a tablet or desktop,
 * the grouped pill on a phone (`phone/SegmentedTabs.tsx`, which holds the one
 * tablist implementation: APG tabs, automatic activation, roving tabindex,
 * arrows mirrored in Hebrew). The selection is the page's, in the URL.
 *
 * No motion: the underline moves by being drawn on a different tab, not by
 * sliding (`docs/motion-contract.md`).
 */

export type { TabSpec };

export default function Tabs<K extends string>({
  label,
  tabs,
  selected,
  onSelect,
  idBase,
}: {
  label: string;
  tabs: TabSpec<K>[];
  selected: K;
  onSelect: (key: K) => void;
  idBase: string;
}) {
  const lang = useLang();
  return (
    <SegmentedTabs
      label={label}
      tabs={tabs}
      selected={selected}
      onSelect={onSelect}
      idBase={idBase}
      tabId={tabId}
      panelId={panelId}
      formatCount={(n) => fmt(n, lang)}
      classes={{ bar: styles.bar, list: styles.list, tab: styles.tab, icon: styles.icon, count: styles.count }}
    />
  );
}
