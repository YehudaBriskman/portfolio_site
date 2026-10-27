import { Component, type ErrorInfo, type ReactNode } from "react";

/* Suspense does not catch render errors, so a machine with no WebGL threw
   instead of falling back. This is the only error boundary in the app. */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Left in deliberately: a background visual failing must be visible in the
    // console, but must never reach the user as anything but the fallback.
    console.warn("[hero] scene failed, showing poster:", error.message, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
