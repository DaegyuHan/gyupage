/** 책 표지 (없으면 제목 첫 글자로 만든 표지) */
export default function BookCover({ src, title, className = "" }: { src: string | null; title: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`aspect-[2/3] shrink-0 rounded-md object-cover shadow-[0_2px_8px_rgba(20,28,43,0.18)] ${className}`} />;
  }
  return (
    <div
      className={`flex aspect-[2/3] shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-[#5c7cfa] p-2 text-center text-sm font-extrabold leading-tight text-white shadow-[0_2px_8px_rgba(20,28,43,0.18)] ${className}`}
      aria-hidden
    >
      {title.slice(0, 8)}
    </div>
  );
}
