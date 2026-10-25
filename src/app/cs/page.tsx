import CsList from "@/components/cs/CsList";
import { getCsNotes, isCsSample } from "@/lib/cs";

export const metadata = { title: "Daily CS | 규페이지" };

export default function CsPage() {
  return <CsList notes={getCsNotes()} sample={isCsSample()} />;
}
