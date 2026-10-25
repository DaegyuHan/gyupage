import ReadingView from "@/components/books/ReadingView";
import RequireLogin from "@/components/RequireLogin";

export const metadata = { title: "독서 | 규페이지" };

export default function ReadingPage() {
  return (
    <RequireLogin title="독서 기록">
      <ReadingView />
    </RequireLogin>
  );
}
