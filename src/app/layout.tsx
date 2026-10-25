import type { Metadata } from "next";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme 은 아래 스크립트가 미리 넣어서 서버 HTML 과 다를 수 있음 → 경고 무시
    <html lang="ko" className={bricolage.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css"
        />
      </head>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
