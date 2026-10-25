"use client";

/** 저장 실패를 화면 아래에 알려 줌 (조용히 사라지지 않게) */
export default function SaveError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="anim-pop fixed inset-x-4 bottom-24 z-50 md:bottom-5 mx-auto max-w-md rounded-xl bg-[#d64545] px-4 py-3 text-sm font-semibold text-white shadow-lg">
      {message}
    </div>
  );
}
