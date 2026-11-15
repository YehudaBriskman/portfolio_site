import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import type { TranslationStatus } from "@/services/translations";
import { useAdminWords } from "@/i18n/admin";
import { CODE, usePostsPhoneWords } from "./words";
import styles from "./posts.module.css";

const HE: Record<TranslationStatus, StatusKind> = { missing: "missing", stale: "stale", draft: "draft", unverified: "unverified", translated: "translated" };

/*
 * Language and its state as two small glyphs, EN then HE, in place of two pills per row. English says whether
 * the post has unpublished changes; Hebrew says whether it is missing, stale, a draft or done. Always left to
 * right, like the codes themselves.
 */
export default function LangPair({ changes, he }: { changes: boolean; he: TranslationStatus | null | undefined }) {
  const w = useAdminWords();
  const p = usePostsPhoneWords();
  const hebrew = he ?? "translated";
  const en = changes ? w.status.changes : w.status.published;
  const hl = w.heLong[hebrew];
  return (
    <span className={styles.pair} dir="ltr" role="img" aria-label={`${p.english}: ${en}. ${w.areaHebrew}: ${hl}`} title={`${en} · ${hl}`}>
      <span className={styles.lang} aria-hidden="true">
        {CODE.en}
        <StatusGlyph kind={changes ? "changes" : "published"} size={16} showDefault label={en} />
      </span>
      <span className={styles.lang} aria-hidden="true">
        {CODE.he}
        <StatusGlyph kind={HE[hebrew]} size={16} showDefault label={hl} />
      </span>
    </span>
  );
}
