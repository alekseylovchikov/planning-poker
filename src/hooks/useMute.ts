import { useState, useCallback } from "react";

export function useMute() {
  const [isMuted, setIsMuted] = useState(() => {
    const value = localStorage.getItem("isMuted");
    const parsed = value ? JSON.parse(value) : undefined;
    return typeof parsed === "boolean" ? parsed : true;
  });

  const toggleMute = useCallback(() => {
    setIsMuted((prev: boolean) => {
      const next = !prev;
      localStorage.setItem("isMuted", String(next));
      return next;
    });
  }, []);

  return { isMuted, toggleMute } as const;
}
