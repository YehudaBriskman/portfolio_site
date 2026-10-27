/// <reference types="vite/client" />

/*
 * `fetchpriority`, spelled the way React 18 will actually emit it.
 *
 * @types/react 18.3 declares the camelCase `fetchPriority`, so every call site
 * type-checked — but the React 18 runtime does not know the prop, drops it,
 * and logs "React does not recognize the fetchPriority prop". The attribute
 * never reached the DOM, which means the priority hint on the LCP image has
 * never done anything. (React 19 supports the camelCase spelling; this
 * declaration can go when the upgrade lands.)
 *
 * Unknown *lowercase* attributes are passed straight through by React 18, so
 * the lowercase spelling works today. Declaring it here keeps the call sites
 * typed rather than cast.
 */
declare module "react" {
  interface ImgHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}

export {};
