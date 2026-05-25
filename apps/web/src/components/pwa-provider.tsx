"use client"

import { useEffect } from "react"

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((entry) => entry.unregister())))
        .catch(() => undefined)
      return
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])

  return children
}
