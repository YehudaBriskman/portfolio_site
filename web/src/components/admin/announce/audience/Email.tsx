/* An address is Latin text and reads left to right even inside a right-to-left row: isolated so it neither flips nor drags its neighbours. */
export default function Email({ value }: { value: string }) {
  return <bdi dir="ltr" className="break-all">{value}</bdi>;
}
