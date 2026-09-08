"use client";

import { useState } from "react";
import clsx from "clsx";

/** Swap every <input>/<textarea> inside `root` for a plain <span> that shows
 *  the same text with the same classes. Form controls rasterize with the
 *  browser's default (white) field background inside modern-screenshot's
 *  <foreignObject> on Safari/Firefox — producing a stray white box in the
 *  capture. Returns a function that restores the DOM exactly. */
function freezeFormControls(root: HTMLElement): () => void {
  const swaps: Array<{ ctrl: HTMLElement; ghost: HTMLElement }> = [];
  const controls = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  controls.forEach((ctrl) => {
    const ghost = document.createElement("span");
    ghost.className = ctrl.className;
    ghost.textContent = ctrl.value;
    ghost.style.whiteSpace = "pre-wrap";
    ghost.style.display = getComputedStyle(ctrl).display === "block" ? "block" : "inline-block";
    ghost.style.background = "transparent";
    ctrl.style.display = "none";
    ctrl.parentNode?.insertBefore(ghost, ctrl.nextSibling);
    swaps.push({ ctrl, ghost });
  });
  return () => {
    swaps.forEach(({ ctrl, ghost }) => {
      ghost.remove();
      ctrl.style.removeProperty("display");
    });
  };
}

/** capture a node to PNG via modern-screenshot (robust with Tailwind v4
 *  oklch / color-mix). guarded by a timeout so it can't hang the UI.
 *  `fixedWidth` pins the output width so every day in a batch is identical
 *  regardless of layout-settle timing or browser-extension DOM noise. */
export async function nodeToPng(
  id: string,
  scale = 2.5,
  fixedWidth?: number,
): Promise<Blob | null> {
  const el = document.getElementById(id);
  if (!el) return null;
  const { domToBlob } = await import("modern-screenshot");
  const restore = freezeFormControls(el);
  try {
    const job = domToBlob(el, {
      width: fixedWidth ?? Math.ceil(el.scrollWidth),
      height: Math.ceil(el.scrollHeight),
      scale,
      backgroundColor: "#faf8f5",
      style: { transform: "none" },
      filter: (n) =>
        !(n instanceof HTMLElement && n.dataset.noCapture !== undefined),
    });
    const timeout = new Promise<null>((res) =>
      setTimeout(() => res(null), 20000),
    );
    return await Promise.race([job, timeout]);
  } finally {
    restore();
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const btn =
  "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 disabled:opacity-50";

export function CaptureButton({
  targetId,
  filename,
  label = "이미지 저장",
  className,
}: {
  targetId: string;
  filename: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      data-no-capture
      className={clsx(btn, className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await nodeToPng(targetId);
          if (blob) saveBlob(blob, filename);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "생성 중…" : `⤓ ${label}`}
    </button>
  );
}

export function CaptureAllButton({
  targets,
  zipName,
  label = "전체 저장 (zip)",
  className,
}: {
  targets: { id: string; filename: string }[];
  zipName: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <button
      type="button"
      data-no-capture
      className={clsx(btn, className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setProgress(0);
        try {
          const JSZip = (await import("jszip")).default;
          const zip = new JSZip();
          for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            const blob = await nodeToPng(t.id);
            if (blob) zip.file(t.filename, blob);
            setProgress(Math.round(((i + 1) / targets.length) * 100));
          }
          const out = await zip.generateAsync({ type: "blob" });
          saveBlob(out, zipName);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? `생성 중… ${progress}%` : `⤓ ${label}`}
    </button>
  );
}
