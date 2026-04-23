import { useState, useEffect } from "react";

export function useRoom(serverRoomId: string | undefined) {
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("room");
  });

  useEffect(() => {
    if (serverRoomId && serverRoomId !== roomId) {
      const newRoomId = serverRoomId ?? null;
      setTimeout(() => setRoomId(newRoomId), 0);

      const params = new URLSearchParams(window.location.search);
      params.set("room", serverRoomId);
      window.history.pushState({}, "", `?${params.toString()}`);
    }
  }, [serverRoomId, roomId]);

  return { roomId } as const;
}
