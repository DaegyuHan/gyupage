"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 진행 중 경기 화면을 주기적으로 새로 고침 (서버 캐시 5분과 맞춤) */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
