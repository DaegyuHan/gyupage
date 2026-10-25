"use client";

import TodayHero from "@/components/calendar/TodayHero";
import { useEventEditor } from "@/components/calendar/useEventEditor";
import EsportsCard from "@/components/EsportsCard";
import F1Card from "@/components/F1Card";
import FootballPanel from "@/components/football/FootballPanel";
import NewsPlaceholder from "@/components/NewsPlaceholder";
import CsCard from "@/components/cs/CsCard";
import GithubCard from "@/components/github/GithubCard";
import GamesSection from "@/components/games/GamesSection";
import MyTeamCard from "@/components/myteam/MyTeamCard";
import { useRouter } from "next/navigation";
import LegacyImport from "@/components/LegacyImport";
import { todayKey } from "@/lib/date";
import { useEvents } from "@/lib/eventStore";
import HourlyWeather from "@/components/weather/HourlyWeather";
import WeatherNow from "@/components/weather/WeatherNow";
import { useWeather } from "@/components/weather/useWeather";
import TodayTodos from "./TodayTodos";
import WeekBoard from "./WeekBoard";
import { useHomeMatches } from "./useHomeMatches";

/** 홈: 오늘 + 일정(7일, 날씨 포함) + 소식 + Daily CS + 축구·F1·e스포츠 */
export default function HomeView() {
  const store = useEvents();
  const editor = useEventEditor(store);
  const weather = useWeather();
  const matches = useHomeMatches();
  const router = useRouter();

  // 서버(UTC)와 브라우저(KST)의 '오늘'이 달라질 수 있어 클라이언트에서만 그림
  if (!store.loaded) return <div className="h-[70vh]" aria-busy="true" />;

  const today = todayKey();

  return (
    <>
      <LegacyImport onDone={store.reload} />
      <TodayHero events={store.events} onOpen={editor.openEdit}>
        <TodayTodos />
      </TodayHero>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-12">
          <WeekBoard
            events={store.events}
            start={today}
            onAdd={(k) => (store.authed ? editor.openNew(k) : router.push("/login?next=/"))}
            onOpen={editor.openEdit}
            weather={weather.data ? new Map(weather.data.days.map((d) => [d.date, d])) : undefined}
            matches={matches}
            headerExtra={
              <WeatherNow
                data={weather.data}
                failed={weather.failed}
                placeName={weather.placeName}
                isMine={!!weather.place}
                locating={weather.locating}
                onUseMyLocation={weather.useMyLocation}
                onReset={weather.resetPlace}
              />
            }
          />
          {weather.data && <HourlyWeather hours={weather.data.hours} placeName={weather.placeName} />}
          <NewsPlaceholder />
          <CsCard />
          <GithubCard />
          <GamesSection />
        </div>
        <aside className="space-y-10">
          <MyTeamCard />
          <FootballPanel />
          <F1Card />
          <EsportsCard />
        </aside>
      </div>

      {editor.modal}
    </>
  );
}
