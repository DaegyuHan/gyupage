"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-client";

/** 로그인해야 보이는 화면을 감쌈 */
export default function RequireLogin({ title, children }: { title: string; children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  if (auth.loading) return <div className="h-[50vh]" aria-busy="true" />;
  if (!auth.authed) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}은 로그인해야 보여요</h1>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper">
          로그인
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
