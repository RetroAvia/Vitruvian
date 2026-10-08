import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vitruvian · Body Composition Intelligence",
    short_name: "Vitruvian",
    description: "Composizione corporea, analisi del sangue e nutrizione in un'unica app.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    lang: "it",
    // tieni premuta l'icona dell'app: avvio diretto dell'allenamento
    shortcuts: [
      { name: "Allenati", short_name: "Allenati", description: "Avvia o riprendi l'allenamento di oggi", url: "/training?log=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Nuova visita", short_name: "Visita", url: "/checkups?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
