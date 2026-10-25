import type { MetadataRoute } from "next";

/** 홈 화면에 추가했을 때 앱처럼 열리게 (iOS·안드로이드 공통) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "규페이지",
    short_name: "규페이지",
    description: "나만의 개인 맞춤 홈페이지",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef1f5",
    theme_color: "#eef1f5",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
