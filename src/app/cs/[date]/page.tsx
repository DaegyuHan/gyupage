import { notFound } from "next/navigation";
import CsArticle from "@/components/cs/CsArticle";
import { getCsNote, getCsNotes, isCsSample } from "@/lib/cs";

type Params = { params: Promise<{ date: string }> };

export function generateStaticParams() {
  return getCsNotes().map((n) => ({ date: n.date }));
}

export async function generateMetadata({ params }: Params) {
  const { date } = await params;
  const found = getCsNote(date);
  return { title: found ? `${found.note.title} | Daily CS` : "Daily CS | 규페이지" };
}

export default async function CsNotePage({ params }: Params) {
  const { date } = await params;
  const found = getCsNote(date);
  if (!found) notFound();
  return <CsArticle {...found} sample={isCsSample()} />;
}
