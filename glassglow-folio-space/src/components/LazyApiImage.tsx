// src/components/LazyApiImage.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";

type LazyApiImageProps = {
  apiSrc: string;
  alt: string;
  className?: string;
  requestInit?: RequestInit;
  fallback?: React.ReactNode;
  skeletonClassName?: string;
  retries?: number;
};

export const LazyApiImage: React.FC<LazyApiImageProps> = ({
  apiSrc,
  alt,
  className,
  requestInit,
  fallback,
  skeletonClassName = "bg-white/10 animate-pulse",
  retries = 1,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const attemptRef = useRef(0);
  const startedRef = useRef(false);

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const fetchOnce = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    setStatus("loading");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    attemptRef.current = 0;

    const doFetch = async (): Promise<void> => {
      try {
        const res = await fetch(apiSrc, {
          method: "GET",
          signal: ac.signal,
          cache: "default",
          ...requestInit,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        cleanupObjectUrl();
        setObjectUrl(url);
        setStatus("ready");
      } catch (err) {
        if (ac.signal.aborted) return;
        if (attemptRef.current < retries) {
          attemptRef.current += 1;
          const backoff = 250 * attemptRef.current;
          setTimeout(doFetch, backoff);
        } else {
          setStatus("error");
          console.error("[LazyApiImage] failed:", err);
        }
      }
    };

    await doFetch();
  }, [apiSrc, requestInit, retries, cleanupObjectUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    startedRef.current = false;
    setStatus("idle");
    attemptRef.current = 0;

    ioRef.current?.disconnect();
    ioRef.current = new IntersectionObserver(
      (entries, obs) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && status === "idle") {
          obs.unobserve(el);
          fetchOnce();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );
    ioRef.current.observe(el);

    return () => {
      ioRef.current?.disconnect();
    };
  }, [apiSrc]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cleanupObjectUrl();
    };
  }, [cleanupObjectUrl]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className || ""}`}>
      {status === "ready" && objectUrl ? (
        <img
          src={objectUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      ) : status === "error" ? (
        fallback ?? (
          <div className="w-full h-full flex items-center justify-center bg-black/30 text-red-300 text-sm">
            failed to load image
          </div>
        )
      ) : (
        <div className={`w-full h-full ${skeletonClassName}`} />
      )}
    </div>
  );
};
