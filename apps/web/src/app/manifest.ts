import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fluxora",
    short_name: "Fluxora",
    description:
      "Cockpit financeiro mobile-first para operar o negócio com velocidade de app.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#242424",
    theme_color: "#242424",
    orientation: "portrait",
    lang: "pt-BR",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  }
}
