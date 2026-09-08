"use client";

import { useState } from "react";
import clsx from "clsx";

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

/** Password field with a tiny A / 한 · Caps-Lock badge inside the input (appears
 *  once you start typing, so the form never shifts).
 *
 *  Note: macOS forces `type="password"` fields to Roman input at the OS level, so
 *  a Korean IME cannot reach the field there — the value stays ASCII (the badge
 *  reads "A") and the password enters correctly regardless of the menu-bar
 *  language. Where an IME can reach the field (Windows), Hangul turns the badge
 *  "한". The DOM value is mirrored locally so a controlled `value` can't
 *  interrupt IME composition. */
export function PasswordInput({
  value,
  onChange,
  className,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [caps, setCaps] = useState(false);
  const [composing, setComposing] = useState(false);

  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!composing && value !== local) setLocal(value);
  }

  const mode: "ko" | "en" | null = HANGUL.test(local) ? "ko" : local ? "en" : null;

  const syncCaps = (e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === "function") {
      setCaps(e.getModifierState("CapsLock"));
    }
  };

  return (
    <div className="relative">
      <input
        type="password"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={local}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          if (!(e.nativeEvent as InputEvent).isComposing) onChange(v);
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false);
          const v = e.currentTarget.value;
          setLocal(v);
          onChange(v);
        }}
        onKeyDown={syncCaps}
        onKeyUp={syncCaps}
        className={clsx(className, "pr-9")}
        placeholder={placeholder}
      />
      {(mode || caps) && (
        <span className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] font-semibold">
          {caps && (
            <span className="text-warn" title="Caps Lock 켜짐">
              ⇪
            </span>
          )}
          {mode === "ko" ? (
            <span
              className="rounded bg-warn/15 px-1 leading-4 text-warn"
              title="한글이 입력되고 있습니다 — 영문으로 바꾸세요"
            >
              한
            </span>
          ) : mode === "en" ? (
            <span
              className="rounded bg-g3/50 px-1 leading-4 text-ink-2"
              title="영문 입력"
            >
              A
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
