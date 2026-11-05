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
import HealthCard from "./HealthCard";
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
  // 넓은 화면(두 칸)인지 — 좁으면 한 줄로 순서를 바꿔서 보여줌
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (!mounted) return <div className="h-[70vh]" aria-busy="true" />;

  const today = todayKey();

  const week = (
    <WeekBoard
      loading={!store.loaded}
      // 휴대폰에선 프로젝트(긴 막대)는 빼고 그날 일정만
      events={wide ? weekEvents : weekEvents.filter((e) => e.category !== "project")}
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
          isApprox={weather.isApprox}
          locating={weather.locating}
          onUseMyLocation={weather.useMyLocation}
          onReset={weather.resetPlace}
        />
      }
    />
  );
  const hourly = weather.data && <HourlyWeather hours={weather.data.hours} placeName={weather.placeName} />;
  const news = (
    <LazyMount minHeight={420}>
      <NewsPlaceholder />
    </LazyMount>
  );
  const cs = (
    <LazyMount minHeight={280}>
      <CsCard />
    </LazyMount>
  );
  const github = (
    <LazyMount minHeight={300}>
      <GithubCard />
    </LazyMount>
  );
  const games = (
    <LazyMount minHeight={320}>
      <GamesSection />
    </LazyMount>
  );
  const reading = (
    <LazyMount minHeight={200}>
      <ReadingSection />
    </LazyMount>
  );
  const health = (
    <LazyMount minHeight={200}>
      <HealthCard />
    </LazyMount>
  );
  const f1 = (
    <LazyMount minHeight={420}>
      <F1Card />
    </LazyMount>
  );
  const esports = (
    <LazyMount minHeight={300}>
      <EsportsCard />
    </LazyMount>
  );

  return (
    <>
      <LegacyImport onDone={store.reload} />
      <SaveError message={store.error} />
      <TodayHero events={events} loading={!store.loaded} onOpen={editor.openEdit}>
        <TodayTodos />
      </TodayHero>

      {wide ? (
        <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-12">
            {week}
            {hourly}
            {news}
            {cs}
            {github}
            {games}
            {reading}
            {health}
          </div>
          <aside className="space-y-10">
            <MyTeamCard />
            <FootballPanel />
            {f1}
            {esports}
          </aside>
        </div>
      ) : (
        // 휴대폰·좁은 화면: 일정 → 날씨 → My Team → 축구 → 독서 → 소식 → CS → 나머지
        <div className="mt-8 min-w-0 space-y-12">
          {week}
          {hourly}
          <MyTeamCard />
          <FootballPanel />
          {reading}
          {news}
          {cs}
          {github}
          {games}
          {health}
          {f1}
          {esports}
        </div>
      )}

      {editor.modal}
    </>
  );
}
