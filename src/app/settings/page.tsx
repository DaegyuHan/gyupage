import BookSettings from "@/components/books/BookSettings";
import CalendarFeedSettings from "@/components/CalendarFeedSettings";
import RequireLogin from "@/components/RequireLogin";
import WidgetSettings from "@/components/WidgetSettings";
import HistoryUpload from "@/components/HistoryUpload";
import MonitorSettings from "@/components/MonitorSettings";
import PushSettings from "@/components/PushSettings";

export const metadata = { title: "설정 | 규페이지" };

export default function SettingsPage() {
  return (
    <RequireLogin title="설정">
      <div className="mx-auto min-w-0 max-w-5xl overflow-x-clip pb-16">
        <header className="border-b border-line pb-6 pt-6">
          <h1 className="text-4xl font-extrabold tracking-tight">설정</h1>
        </header>
        <div className="min-w-0 space-y-14 pt-8 [&>section]:min-w-0">
          <PushSettings />
          <BookSettings />
          <HistoryUpload />
          <WidgetSettings />
          <CalendarFeedSettings />
          <MonitorSettings />
        </div>
      </div>
    </RequireLogin>
  );
}
