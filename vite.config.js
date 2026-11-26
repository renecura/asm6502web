
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    base: "renecura.github.io/asm6502web",
    plugins: [
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "logo.svg"],
            manifest: {
                name: "6502 Assembler",
                short_name: "6502",
                description: "Ensamblador 6502 en el navegador",
                lang: "es",
                display: "standalone",
                background_color: "#10131b",
                theme_color: "#5268d9",
                start_url: "./",
                scope: "./",
                icons: [
                    { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
                    { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
                    { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
                    { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
            },
        }),
    ],
});