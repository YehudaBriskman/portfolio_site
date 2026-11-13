import { Fragment } from "react";

/*
 * An address is Latin text and reads left to right even inside a right-to-left row: isolated so it neither flips
 * nor drags its neighbours. It may break before "@" and before each ".", so a narrow column splits at the
 * address's own seams; `anywhere` is only the last resort for one very long segment.
 */
export default function Email({ value }: { value: string }) {
  if (!value) return <span aria-hidden="true">—</span>;
  const parts = value.split(/(?=[@.])/);
  return (
    <bdi dir="ltr" className="[overflow-wrap:anywhere]">
      {parts.map((p, i) => (i === 0 ? p : <Fragment key={i}><wbr />{p}</Fragment>))}
    </bdi>
  );
}
