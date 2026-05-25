"use client"

import { useEffect } from "react"

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const standaloneQuery = window.matchMedia("(display-mode: standalone)")
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)")

    const syncDisplayMode = () => {
      const isStandalone =
        standaloneQuery.matches ||
        fullscreenQuery.matches ||
        ("standalone" in navigator &&
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

      root.dataset.displayMode = isStandalone ? "standalone" : "browser"
    }

    const observeQuery = (query: MediaQueryList) => {
      if ("addEventListener" in query) {
        query.addEventListener("change", syncDisplayMode)
        return () => query.removeEventListener("change", syncDisplayMode)
      }

      const legacyQuery = query as MediaQueryList & {
        addListener: (listener: (event: MediaQueryListEvent) => void) => void
        removeListener: (listener: (event: MediaQueryListEvent) => void) => void
      }

      legacyQuery.addListener(syncDisplayMode)
      return () => legacyQuery.removeListener(syncDisplayMode)
    }

    syncDisplayMode()
    const stopStandaloneObserver = observeQuery(standaloneQuery)
    const stopFullscreenObserver = observeQuery(fullscreenQuery)

    const cleanup = () => {
      stopStandaloneObserver()
      stopFullscreenObserver()
    }

    if (!("serviceWorker" in navigator)) {
      return cleanup
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((entry) => entry.unregister())))
        .catch(() => undefined)
      return cleanup
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined)

    return cleanup
  }, [])

  return children
}
