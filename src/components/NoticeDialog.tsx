"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CONTACT_EMAIL } from "@/lib/contact";
import { noticeHidden } from "@/lib/notice";
import { todayKST } from "@/lib/schedule";

const DAY_KEY = "gkt_notice_hidden_on"; // localStorage: "오늘 하루 보지 않기"를 누른 한국 날짜

/* 숨김 여부는 브라우저 저장소가 원본 — useSyncExternalStore로 읽어 서버 렌더(숨김)와
 * 클라이언트(저장소 값)가 어긋나도 하이드레이션 오류 없이 넘어간다. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function read(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null; // 저장소를 못 쓰면 매번 띄운다
  }
}
function write(store: () => Storage, key: string, value: string) {
  try {
    store().setItem(key, value);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
function readHiddenOn(): string | null {
  return read(() => localStorage, DAY_KEY);
}

/** 모든 화면에 먼저 뜨는 공지 모달(로그인 여부와 상관없이). 국악고 선생님이
 *  비밀번호·수정·운영 문의를 어디로 보낼지 바로 알 수 있게.
 *  닫기 = 지금 쪽에서만 숨김(다른 쪽으로 가면 다시) · 오늘 하루 보지 않기 = 그 브라우저에서 한국 날짜로 오늘까지 숨김. */
export function NoticeDialog() {
  const path = usePathname();
  // 서버 렌더에선 "오늘 숨김"으로 두어(모달 없음) 하이드레이션 뒤에 뜬다
  const hiddenOn = useSyncExternalStore(subscribe, readHiddenOn, () => todayKST());
  const [closedOnPath, setClosedOnPath] = useState<string | null>(null);
  const [hiddenToday, setHiddenToday] = useState(false); // 저장소가 막혀도 그날은 닫히게
  const open =
    !hiddenToday && !noticeHidden({ closedOnPath, path, hiddenOn, today: todayKST() });
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => setClosedOnPath(path);
  const hideToday = () => {
    write(() => localStorage, DAY_KEY, todayKST());
    setHiddenToday(true);
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosedOnPath(path); // 지금 쪽에서 닫기(쪽이 바뀌면 새 경로로 다시 건다)
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, path]);

  if (!open) return null;

  return (
    <>
      <div className="no-print fixed inset-0 z-40 bg-ink/45" onClick={close} role="presentation" data-no-capture />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gkt-notice-title"
        data-no-capture
        className="no-print fixed left-4 right-4 top-[14vh] z-50 mx-auto max-w-sm break-keep rounded-xl border border-line bg-paper px-5 py-6 shadow-2xl [overflow-wrap:anywhere]"
      >
        <p className="text-[12px] font-semibold tracking-wide text-ink-2">안내</p>
        <h2 id="gkt-notice-title" className="mt-1.5 font-serif text-[20px] font-medium leading-snug">
          국악고 선생님께
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">
          이 사이트는 국립국악고등학교 강사·강의실 시간표를 보고 짜는 곳입니다. 학생 이름이
          있어 비밀번호가 있어야 열립니다.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          서비스는 언제나 열려 있습니다. 비밀번호를 받으시려면, 기능을 고치거나 더하고
          싶으시면, 운영에 관해 물어볼 것이 있으면 아래 주소로 메일을 주세요.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-3 block rounded-lg border border-line-strong bg-paper-2 px-3 py-2.5 text-center text-[15px] text-ink"
        >
          {CONTACT_EMAIL}
        </a>
        <div className="mt-4 flex gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="h-10 flex-1 rounded-md border border-line-strong text-[14px] text-ink-2"
          >
            닫기
          </button>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[국악고 시간표] 문의")}`}
            className="flex h-10 flex-1 items-center justify-center rounded-md bg-ink text-[14px] text-paper"
          >
            메일 보내기
          </a>
        </div>
        <button
          type="button"
          onClick={hideToday}
          className="mt-2 h-11 w-full text-[13px] text-ink-2 underline decoration-line-strong underline-offset-4"
        >
          오늘 하루 보지 않기
        </button>
      </div>
    </>
  );
}
