"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_INACTIVE_COLOR, DEFAULT_INACTIVE_PATTERN, type InactivePattern } from "./types";

export interface InactiveStyle {
  color: string;
  pattern: InactivePattern;
}

const InactiveStyleContext = createContext<InactiveStyle>({
  color: DEFAULT_INACTIVE_COLOR,
  pattern: DEFAULT_INACTIVE_PATTERN,
});

/** provided once near the root (RootLayout) from Settings.inactive_color /
 *  inactive_pattern, so Cell.tsx can render the admin-picked look without
 *  threading it through every intermediate component. */
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
