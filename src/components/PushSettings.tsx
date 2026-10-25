"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import { DEFAULT_PREFS, PUSH_KINDS, type PushKind, type PushPrefs } from "@/lib/pushKinds";

type Status = "checking" | "unsupported" | "ios-browser" | "no-server" | "denied" | "off" | "on";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "기기";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${os}${br ? ` · ${br}` : ""}`;
}

async function registration() {
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  return reg;
}

/** 설정 > 알림: 이 기기에서 푸시 받기 + 받을 알림 고르기 */
export default function PushSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const check = useCallback(async () => {
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus(ios && !standalone ? "ios-browser" : "unsupported");
      return;
    }
    const { enabled } = await api<{ enabled: boolean }>("/api/push/key");
    if (!enabled) return setStatus("no-server");
    if (Notification.permission === "denied") return setStatus("denied");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setEndpoint(sub?.endpoint ?? null);
    setStatus(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    check().catch(() => setStatus("unsupported"));
    api<{ value: Partial<PushPrefs> | null }>("/api/prefs/push")
      .then((j) => setPrefs({ ...DEFAULT_PREFS, ...(j.value ?? {}) }))
      .catch(() => {});
  }, [check]);

  const turnOn = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // 아이폰은 버튼을 누른 그 순간에 권한을 물어야 해서 맨 먼저
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        return;
      }
      const { key } = await api<{ key: string | null }>("/api/push/key");
      if (!key) return setStatus("no-server");
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      await api("/api/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), device: deviceName() } });
      setEndpoint(sub.endpoint);
      setStatus("on");
      setMsg("알림을 켰어요. 테스트 알림을 보내 볼까요?");
    } catch (e) {
      setMsg(`켜지 못했어요: ${String(e).replace(/^Error: /, "")}`);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setStatus("off");
      setMsg("이 기기 알림을 껐어요.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { sent } = await api<{ sent: number }>("/api/push/test", { method: "POST", body: { endpoint } });
      setMsg(sent ? "보냈어요! 몇 초 안에 도착해요." : "보낼 기기를 찾지 못했어요. 알림을 껐다 다시 켜 보세요.");
    } catch (e) {
      setMsg(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: PushKind) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    api("/api/prefs/push", { method: "PUT", body: { value: next } }).catch(() => setPrefs(prefs));
  };

  const note: Record<Status, string> = {
    checking: "확인하는 중…",
    unsupported: "이 브라우저는 푸시 알림을 지원하지 않아요.",
    "ios-browser": "아이폰은 사파리에서 공유 → '홈 화면에 추가'로 설치한 규페이지 앱에서만 알림을 켤 수 있어요. 홈 화면 아이콘으로 열고 다시 들어와 주세요.",
    "no-server": "서버에 VAPID 키가 아직 없어요. Vercel 환경 변수에 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 를 넣고 다시 배포해 주세요.",
    denied: "알림이 차단돼 있어요. 아이폰: 설정 → 알림 → 규페이지에서 허용 / 컴퓨터: 주소창 왼쪽 자물쇠 → 알림 허용.",
    off: "이 기기에서는 알림이 꺼져 있어요.",
    on: "이 기기로 알림이 와요.",
  };

  return (
    <section id="push" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">알림</h2>
      <p className="mt-1 text-sm text-ink-2">일정·경기·할 일을 폰 알림으로 받아요. 기기마다 따로 켜요.</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === "on" ? "bg-[#30a46c]" : status === "off" || status === "checking" ? "bg-ink-3" : "bg-[#f5a524]"}`} />
            <p className="flex-1 text-sm font-semibold">{note[status]}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {status === "off" && (
              <button onClick={turnOn} disabled={busy} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60">
                {busy ? "켜는 중…" : "이 기기에서 알림 켜기"}
              </button>
            )}
            {status === "on" && (
              <>
                <button onClick={test} disabled={busy} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60">
                  테스트 알림 보내기
                </button>
                <button onClick={turnOff} disabled={busy} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:border-ink-3">
                  이 기기 알림 끄기
                </button>
              </>
            )}
          </div>
          {msg && <p className="mt-3 text-xs text-ink-2">{msg}</p>}
        </div>

        <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface">
          {PUSH_KINDS.map((k) => (
            <li key={k.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{k.label}</div>
                  <div className="text-xs text-ink-3">{k.desc}</div>
                </div>
                <input type="checkbox" className="peer sr-only" checked={prefs[k.id]} onChange={() => toggle(k.id)} />
                <span className="relative h-6 w-10 shrink-0 rounded-full bg-sunken transition peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
