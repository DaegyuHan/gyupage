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
import ReadingSection from "@/components/books/ReadingSection";
import MyTeamCard from "@/components/myteam/MyTeamCard";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LazyMount from "@/components/LazyMount";
import LegacyImport from "@/components/LegacyImport";
import SaveError from "@/components/SaveError";
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

  // 오늘 영역은 '오늘 꼭 할 일'이 따로 있어서 할일을 빼고, 주간 일정표에는 할일도 같이 보여줌
  const events = store.events.filter((e) => e.category !== "todo");
  const weekEvents = store.events;

  // 서버(UTC)와 브라우저(KST)의 '오늘'이 달라질 수 있어 화면에 붙은 뒤 바로 그림
  // (예전처럼 일정을 다 받을 때까지 기다리지 않고, 일정 칸만 불러오는 중 표시)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[70vh]" aria-busy="true" />;

  const today = todayKey();

  return (
    <>
      <LegacyImport onDone={store.reload} />
      <SaveError message={store.error} />
      <TodayHero events={events} loading={!store.loaded} onOpen={editor.openEdit}>
        <TodayTodos />
      </TodayHero>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-12">
          <WeekBoard
            loading={!store.loaded}
            events={weekEvents}
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
                isMine={weather.isHere}
                locating={weather.locating}
                onUseMyLocation={weather.useMyLocation}
                onReset={weather.resetPlace}
              />
            }
          />
          {weather.data && <HourlyWeather hours={weather.data.hours} placeName={weather.placeName} />}
          <LazyMount minHeight={420}>
            <NewsPlaceholder />
          </LazyMount>
          <LazyMount minHeight={280}>
            <CsCard />
          </LazyMount>
          <LazyMount minHeight={300}>
            <GithubCard />
          </LazyMount>
          <LazyMount minHeight={320}>
            <GamesSection />
          </LazyMount>
          <LazyMount minHeight={200}>
            <ReadingSection />
          </LazyMount>
        </div>
        <aside className="space-y-10">
          <MyTeamCard />
          <FootballPanel />
          <LazyMount minHeight={420}>
            <F1Card />
          </LazyMount>
          <LazyMount minHeight={300}>
            <EsportsCard />
          </LazyMount>
        </aside>
      </div>

      {editor.modal}
    </>
  );
}
