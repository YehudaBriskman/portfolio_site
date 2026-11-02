// jest-dom's matchers, typed for vitest 5.
//
// jest-dom 6.x/7.x augments `vitest`'s `Assertion<T>` with ONE type parameter.
// Vitest 5 declares `Assertion<R, T>` and expects extensions on `Matchers<R, T>`,
// so jest-dom's own declaration no longer merges and every `toBeInTheDocument()`
// fails typecheck (the matchers still run: setupTests registers them). Drop this
// file once @testing-library/jest-dom ships a vitest 5 declaration.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
}
