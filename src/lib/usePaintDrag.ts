import { useEffect, useRef, useState } from "react";

/** Mouse "paint" across grid items: press on one, drag over others, release
 *  to commit them all with the value chosen at the press (e.g. activate vs
 *  deactivate, approve vs lock). Used by the timetable's 비활성 지정 and the
 *  month calendar's 승인 지정.
 *
 *  Items are kept as objects keyed by `keyFn`, never re-parsed from the key —
 *  so keys can contain anything (room names like "강의실 7" have spaces). */
export function usePaintDrag<T, V>(
  enabled: boolean,
  keyFn: (item: T) => string,
  onCommit: (items: T[], value: V) => void,
) {
  const drag = useRef<{ value: V; items: Map<string, T> } | null>(null);
  const [preview, setPreview] = useState<Set<string>>(new Set());
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });

  useEffect(() => {
    if (!enabled) return;
    const up = () => {
      const d = drag.current;
      drag.current = null;
      setPreview(new Set());
      if (d && d.items.size) commitRef.current([...d.items.values()], d.value);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [enabled]);

  return {
    /** press on an item — `value` is what the whole drag will apply */
    start(item: T, value: V) {
      drag.current = { value, items: new Map([[keyFn(item), item]]) };
      setPreview(new Set([keyFn(item)]));
    },
    /** pointer entered an item mid-drag */
    enter(item: T) {
      const d = drag.current;
      if (!d) return;
      d.items.set(keyFn(item), item);
      setPreview(new Set(d.items.keys()));
    },
    isPreviewed: (item: T) => preview.has(keyFn(item)),
  };
}
