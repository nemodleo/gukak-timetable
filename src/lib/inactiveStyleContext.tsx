"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  DEFAULT_INACTIVE_BG_COLOR,
  DEFAULT_INACTIVE_PATTERN,
  DEFAULT_INACTIVE_PATTERN_COLOR,
  type InactivePattern,
} from "./types";

export interface InactiveStyle {
  bgColor: string;
  patternColor: string;
  pattern: InactivePattern;
}

const InactiveStyleContext = createContext<InactiveStyle>({
  bgColor: DEFAULT_INACTIVE_BG_COLOR,
  patternColor: DEFAULT_INACTIVE_PATTERN_COLOR,
  pattern: DEFAULT_INACTIVE_PATTERN,
});

/** provided once near the root (RootLayout) from Settings.inactive_*, so
 *  Cell.tsx can render the admin-picked look without threading it through
 *  every intermediate component. */
export function InactiveStyleProvider({
  value,
  children,
}: {
  value: InactiveStyle;
  children: ReactNode;
}) {
  return (
    <InactiveStyleContext.Provider value={value}>{children}</InactiveStyleContext.Provider>
  );
}

export function useInactiveStyle(): InactiveStyle {
  return useContext(InactiveStyleContext);
}
