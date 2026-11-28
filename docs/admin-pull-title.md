# Pull to reveal the page title (admin phone, #896)

The admin phone has no top bar. The page title is not in the normal flow: at the top of the page a further downward pull draws it in from above (fading in from transparent, proportional to the pull), and releasing sends it back.

## What we looked at

- Apple HIG, Navigation bars: a large title is shown at the top of the content, collapses to a standard title once the content scrolls, and returns when the person scrolls back to the top; it "remind[s] them of their current location". We take the idea (the title belongs to the top edge, it is where you are) and make it a transient reveal. https://developer.apple.com/design/human-interface-guidelines/navigation-bars
- Chrome for Developers, "Take control of your scroll": `overscroll-behavior-y: contain` (or `none`) on the viewport element switches off Chrome Android's pull-to-refresh and the glow; `contain` keeps local edge effects, `none` removes the iOS rubber-band too. https://developer.chrome.com/blog/overscroll-behavior
- Safari 16 added `overscroll-behavior`; before that, and still with `contain`, iOS rubber-bands and reports it as a negative `scrollTop` / `scrollY`. That is the one reliable signal on iOS, and it fires scroll events. (community write-ups, e.g. https://lovemewithoutall.github.io/it/ios-bounce-scroll-1-eng/ ). WebKit has open bugs where a smooth `scrollTo` during a rubber-band leaves a stuck negative offset (https://webkit.org/b/176454), so we never call `scrollTo` from this code.
- iOS Mail, Messages and Settings reveal their search field the same way: the pull at the top of the list moves the hidden element in, and the rest position wins when the finger lifts. Telegram and WhatsApp do the same with their search bar. (Behaviour observed, not documented by the vendors.)

## Pitfalls that shaped the design

- Chrome Android has no rubber-band: the page does not move past the top, so we cannot read an overscroll. We track the finger ourselves (`touchstart` at `scrollY <= 0`, then `touchmove`) and damp it.
- iOS does rubber-band, so the page and our title both move. The title is a fixed overlay, so the two do not fight; the scroll-event source covers a bounce without a tracked touch (a flick up to the top).
- A native pull-to-refresh would fire under the same gesture on Android: `overscroll-behavior-y: contain` on the root (phone only).
- A gesture that starts below the top must never be taken: the machine arms only on a touch that starts at the top, and disarms when the page scrolls, the finger moves up, or a popup opens. Listeners are passive and never `preventDefault`.
- Headless Chromium here has about one frame per 40 s: the rest state is set by a timer, not `animationend`, and the tests poll by hand.

## The approach

- `ui/pullReveal.ts`: a pure state machine (`pullStart`, `pullMove`, `pullEnd`, `damp`, `overscrollOffset`) and `usePullReveal`. Threshold 8px, cap 72px, `offset = 72 * (1 - exp(-d / 115))`.
- `ui/PullTitle.tsx`: writes one custom property `--pull` (0..1) to the node. CSS reads it for `transform: translateY` and `opacity` only, no layout, no keyframes. While held it follows the finger; on release a 220ms transition (only under `prefers-reduced-motion: no-preference`) returns it, and a timer marks it at rest.
- Reduced motion or the site's Pause: no travel; opacity steps 0 or 1 on the same gesture.
- Accessibility: the visible title is `aria-hidden`. The real page `h1` stays in the document (clipped to 1px on a phone, not `display: none`), so there is exactly one h1 and a screen reader always finds it. `document.title` is unchanged. A keyboard or switch user has no gesture and needs none: the h1 and the drawer's current item say where they are, and the back pill names the parent section.
- Phone only: `enabled` is `usePhone()`. Crossing 600px unmounts the node and removes every listener; at and above 600px the admin is byte for byte the old one (top bar, PageHeader h1).
