"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface UIContextType {
  isSidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isSidebarVisible, setSidebarVisible] = useState(true);

  return (
    <UIContext.Provider value={{ isSidebarVisible, setSidebarVisible }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
