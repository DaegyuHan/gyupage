"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import type { WeatherResponse } from "@/lib/weather";

const KEY = "gyupage.weatherPlace";

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** 날씨 + 위치(기본 고양, '내 위치'로 바꿀 수 있음) */
export function useWeather() {
  const [place, setPlace] = useState<Place | null>(null); // null = 기본(고양)
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);

  const auth = useAuth();

  // 로그인했으면 DB 설정(어느 기기든 같게), 아니면 이 브라우저 설정
  useEffect(() => {
    if (auth.loading) return;
    if (auth.authed) {
      api<{ value: Place | null }>("/api/prefs/weatherPlace")
        .then((j) => setPlace(j.value))
        .catch(() => {})
        .finally(() => setReady(true));
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPlace(JSON.parse(raw) as Place);
    } catch {
      /* 무시 */
    }
    setReady(true);
  }, [auth.loading, auth.authed]);

  useEffect(() => {
    if (!ready) return;
    const qs = place ? `?lat=${place.lat}&lon=${place.lon}` : "";
    setFailed(false);
    fetch(`/api/weather${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: WeatherResponse) => setData(d))
      .catch(() => setFailed(true));
  }, [place, ready]);

  const save = (p: Place | null) => {
    setPlace(p);
    if (auth.authed) {
      api("/api/prefs/weatherPlace", { method: "PUT", body: { value: p } }).catch(() => {});
      return;
    }
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
  };

  /** 브라우저 위치 권한으로 내 위치 날씨 보기 */
  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        save({ name: "내 위치", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setLocating(false),
      { timeout: 10_000, maximumAge: 30 * 60 * 1000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authed]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetPlace = useCallback(() => save(null), [auth.authed]);

  return { data, failed, place, placeName: place?.name ?? "고양", locating, useMyLocation, resetPlace };
}
