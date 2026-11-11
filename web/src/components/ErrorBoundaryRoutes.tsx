import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useLang } from "./dashboard/i18n";

const TEXT = {
  en: { title: "Something went wrong.", body: "The page could not be loaded. Reloading usually fixes it.", button: "Reload" },
  he: { title: "משהו השתבש.", body: "לא ניתן היה לטעון את העמוד. בדרך כלל רענון פותר את זה.", button: "רענון" },
};

function Failed() {
  const t = TEXT[useLang()];
  return (
    <div role="alert" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{t.title}</h1>
      <p style={{ marginBottom: "1rem" }}>{t.body}</p>
      <button type="button" onClick={() => window.location.reload()} style={{ textDecoration: "underline" }}>
        {t.button}
      </button>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] render failed:", error.message, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // Navigating away from the broken page clears the failure.
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? <Failed /> : this.props.children;
  }
}

/* Suspense does not catch a rejected lazy import (a chunk that 404s after a
   deploy) nor a render error; without a boundary React unmounts the whole app. */
export default function RoutesErrorBoundary({ children }: { children: ReactNode }) {
  return <Boundary resetKey={useLocation().pathname}>{children}</Boundary>;
}
