import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Nav from "@/components/Nav";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "규페이지",
  description: "나만의 개인 맞춤 홈페이지",
  // 아이폰 '홈 화면에 추가'로 앱처럼 열기 (주소창 없이 전체 화면)
  appleWebApp: { capable: true, title: "규페이지", statusBarStyle: "default" },
  applicationName: "규페이지",
  formatDetection: { telephone: false, date: false, address: false, email: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 아이폰 노치·홈 바 영역까지 배경을 채우고, 내용은 safe-area 로 피함
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1319" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme 은 아래 스크립트가 미리 넣어서 서버 HTML 과 다를 수 있음 → 경고 무시
    <html lang="ko" className={bricolage.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* 본문 글꼴: 서버에 미리 연결해 두고 받기 (첫 글자가 빨리 보이게) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css"
        />
      </head>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-[1440px] px-4 pb-32 sm:px-8 md:pb-16">{children}</main>
      </body>
    </html>
  );
}
