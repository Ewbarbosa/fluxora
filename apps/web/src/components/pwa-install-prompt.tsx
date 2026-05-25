"use client"

import { useEffect, useState } from "react"
import { DownloadIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === "undefined") {
      return true
    }

    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    )
  })

  useEffect(() => {
    function handleInstalled() {
      setInstallEvent(null)
      setIsStandalone(true)
    }

    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handlePrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  if (isStandalone || !installEvent || dismissed) {
    return null
  }

  async function handleInstall() {
    if (!installEvent) {
      return
    }

    const deferredPrompt = installEvent

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === "accepted") {
      setInstallEvent(null)
      return
    }
    setDismissed(true)
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[1.15rem] border border-[color:var(--app-accent-border)] bg-[color:var(--app-panel-strong)]/92 p-3 shadow-[0_16px_32px_rgba(15,23,32,0.1)] md:hidden">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--app-accent-strong)] text-white">
        <DownloadIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instalar Fluxora</p>
        <p className="text-xs text-muted-foreground">
          Abrir como app, com acesso rápido e experiência mais limpa no celular.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="rounded-xl bg-[color:var(--app-accent-strong)] text-white hover:opacity-90"
        onClick={handleInstall}
      >
        Instalar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-xl"
        onClick={() => setDismissed(true)}
      >
        <XIcon className="size-4" />
        <span className="sr-only">Dispensar</span>
      </Button>
    </div>
  )
}
