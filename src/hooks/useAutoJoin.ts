import { useState, useEffect, useRef, useCallback } from "react";
import { sanitizeName } from "../lib";

interface UseAutoJoinOptions {
  isConnected: boolean;
  join: (name: string, roomId?: string) => void;
  setOnNameTaken: (callback: () => void) => void;
  roomId: string | null;
}

export function useAutoJoin({
  isConnected,
  join,
  setOnNameTaken,
  roomId,
}: UseAutoJoinOptions) {
  const storedName = localStorage.getItem("userName");
  const [userName, setUserName] = useState<string | null>(
    storedName ? sanitizeName(storedName) : null,
  );
  const [isJoining, setIsJoining] = useState(false);
  const hasAttemptedJoinRef = useRef(false);

  useEffect(() => {
    setOnNameTaken(() => {
      setUserName(null);
      localStorage.removeItem("userName");
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
    });
  }, [setOnNameTaken]);

  useEffect(() => {
    if (userName && isConnected && !hasAttemptedJoinRef.current) {
      hasAttemptedJoinRef.current = true;
      setTimeout(() => {
        setIsJoining(true);
        join(userName, roomId || undefined);
      }, 0);
    }
  }, [userName, isConnected, join, roomId]);

  useEffect(() => {
    if (!isConnected) {
      hasAttemptedJoinRef.current = false;
      setTimeout(() => setIsJoining(false), 0);
    }
  }, [isConnected]);

  const handleNameSubmit = useCallback(
    (name: string) => {
      const sanitized = sanitizeName(name);
      setUserName(sanitized);
      localStorage.setItem("userName", sanitized);
      setIsJoining(true);
      if (isConnected) {
        join(sanitized, roomId || undefined);
      }
    },
    [isConnected, join, roomId],
  );

  return { userName, isJoining, handleNameSubmit } as const;
}
