/*
 * The card's geometry, held while the collections request is in flight.
 *
 * A 10px "Loading…" string is not a loading state: the page reflows the moment
 * data lands, and on a slow connection it reads as an empty site. This occupies
 * the same space the real card will.
 */
export default function CardSkeleton() {
  return (
    <div className="card animate-pulse-soft overflow-hidden p-3 sm:p-4" aria-hidden="true">
      <div className="card-shot aspect-[4/3] bg-edge/40 sm:aspect-[16/10]" />
      <div className="px-2 pb-1 pt-5 sm:px-3 sm:pt-6">
        <div className="h-7 w-2/3 rounded-full bg-edge/40" />
        <div className="mt-3 h-4 w-1/2 rounded-full bg-edge/25" />
        <div className="mt-5 flex gap-2">
          {[68, 52, 44].map((w) => (
            <div key={w} className="h-7 rounded-full bg-edge/25" style={{ width: w }} />
          ))}
        </div>
      </div>
    </div>
  );
}
