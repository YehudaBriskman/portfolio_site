import { Fragment } from "react";

/*
 * An address is Latin text and reads left to right even inside a right-to-left row: isolated so it neither flips
 * nor drags its neighbours. The only break opportunity is before the "@": the local part (ada.lovelace) stays
 * whole, and `anywhere` splits it only when it alone is wider than the cell.
 */
export default function Email({ value }: { value: string }) {
  if (!value) return <span aria-hidden="true">—</span>;
  const at = value.lastIndexOf("@");
  return (
    <bdi dir="ltr" className="[overflow-wrap:anywhere]">
      {at > 0 ? <Fragment>{value.slice(0, at)}<wbr />{value.slice(at)}</Fragment> : value}
    </bdi>
  );
}
