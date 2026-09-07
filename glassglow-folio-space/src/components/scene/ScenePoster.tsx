/* Pure-CSS stand-in for the hero scene. One element, no JS, no WebGL.
   This is the fallback for all four failure modes: no WebGL, a thrown scene
   error, a device we deliberately gate out, and a lost GL context. */
export default function ScenePoster() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(58% 44% at 72% 42%, rgb(255 140 66 / 0.14), transparent 70%)," +
          "radial-gradient(46% 38% at 84% 24%, rgb(110 168 199 / 0.10), transparent 72%)," +
          "rgb(18 14 11)",
      }}
    />
  );
}
