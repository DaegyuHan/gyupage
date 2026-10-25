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

/**
 * 날씨 + 위치
 * - 기본: 지금 있는 곳(내 위치, 들어올 때마다 GPS 로 다시 잡음). 위치를 못 쓰면 수원.
 * - '수원으로'를 누르면 수원으로 고정 (로그인하면 DB 에 저장돼서 모든 기기에서 같게)
 * 저장값: null = 내 위치(자동), {name, lat, lon} = 고정한 곳
 */
const SUWON: Place = { name: "수원", lat: 37.2636, lon: 127.0286 };

export function useWeather() {
  const [fixed, setFixed] = useState<Place | null>(null);
  const [here, setHere] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);

  const auth = useAuth();

  // 예전에 저장한 '내 위치' 좌표는 자동(null)으로 봄
  const normalize = (p: Place | null) => (p && p.name !== "내 위치" ? p : null);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.authed) {
      api<{ value: Place | null }>("/api/prefs/weatherPlace")
        .then((j) => setFixed(normalize(j.value)))
        .catch(() => {})
        .finally(() => setReady(true));
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFixed(normalize(JSON.parse(raw) as Place));
    } catch {
      /* 무시 */
    }
    setReady(true);
  }, [auth.loading, auth.authed]);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // 소수 둘째 자리(약 1km)까지만 — 날씨엔 충분하고 캐시도 잘 맞음
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        setHere({ name: "내 위치", lat, lon });
        // 동네 이름 붙이기 (키 없이 쓰는 무료 역지오코딩, 실패하면 '내 위치' 그대로)
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { city?: string; locality?: string; principalSubdivision?: string } | null) => {
            const name = j?.locality || j?.city || j?.principalSubdivision;
            if (name) setHere({ name, lat, lon });
          })
          .catch(() => {});
      },
      () => setLocating(false),
      { timeout: 10_000, maximumAge: 30 * 60 * 1000 },
    );
  }, []);

  // 고정한 곳이 없으면 들어올 때 내 위치를 잡음
  useEffect(() => {
    if (ready && !fixed && !here) locate();
  }, [ready, fixed, here, locate]);

  const place = fixed ?? here; // 둘 다 없으면 서버 기본(수원)

  useEffect(() => {
    if (!ready) return;
    const qs = place ? `?lat=${place.lat}&lon=${place.lon}` : "";
    setFailed(false);
    fetch(`/api/weather${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: WeatherResponse) => setData(d))
      .catch(() => setFailed(true));
  }, [place?.lat, place?.lon, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (p: Place | null) => {
    setFixed(p);
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

  /** 내 위치로 (자동) */
  const useMyLocation = useCallback(() => {
    save(null);
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authed, locate]);

  /** 수원으로 고정 */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetPlace = useCallback(() => save(SUWON), [auth.authed]);

  return {
    data,
    failed,
    place,
    placeName: place?.name ?? "수원",
    /** 지금 내 위치 날씨를 보고 있는지 */
    isHere: !fixed && !!here,
    locating,
    useMyLocation,
    resetPlace,
  };
}
