"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면 근처(아래로 600px 안)에 오면 그때 그림 → 첫 화면에 필요 없는 칸은 요청도 나중에.
 * 그 전에는 같은 높이의 빈 자리만 둬서 화면이 출렁이지 않게.
 */
export default function LazyMount({ children, minHeight = 240 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (!("IntersectionObserver" in window)) {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  if (show) return <>{children}</>;
  return <div ref={ref} style={{ minHeight }} aria-hidden />;
}
