import PageShell from "@/components/PageShell";
import SignupBlock from "@/components/SignupBlock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSubscribeWords } from "@/i18n/subscribe";

/* The signup block on a page of its own, for a link in a bio or a signature. */
export default function Follow() {
  const w = useSubscribeWords();
  useDocumentTitle(w.followTitle);
  return (
    <PageShell>
      <section className="wrap section-y page-first">
        <h1 className="display mt-3 text-section">{w.followTitle}</h1>
        <SignupBlock as="h2" headingHidden className="mt-8" />
        <p className="mt-6 text-sm text-clay">
          {w.followRss}{" "}
          <a className="underline underline-offset-4" href="/feed.xml">
            {w.followRssLink}
          </a>
        </p>
      </section>
    </PageShell>
  );
}
