import { useEffect, useRef, useState, useCallback } from "react";
import type { GameState, VoteValue, WebSocketMessage } from "../types";

const RECONNECT_DELAY_MS = 3000;
/** Минимальное время скрытия вкладки (мс), после которого при показе делаем переподключение */
const VISIBILITY_RECONNECT_THRESHOLD_MS = 15000;

export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    participants: [],
    votesRevealed: false,
    currentVotes: {},
  });
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectOnVisibleRef = useRef(false);
  const hiddenSinceRef = useRef<number | null>(null);
  const onNameTakenRef = useRef<(() => void) | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case "state":
        if (message.payload) {
          const state = message.payload as GameState;
          // Создаем новый объект для гарантии обновления React
          setGameState({
            roomId: state.roomId,
            participants: [...(state.participants || [])],
            votesRevealed: state.votesRevealed || false,
            currentVotes: { ...(state.currentVotes || {}) },
            isCreator: state.isCreator || false,
            canControlVotes: state.canControlVotes || false,
          });
          setError(null);
        }
        break;
      case "name_taken":
        setError("Это имя уже занято");
        if (onNameTakenRef.current) {
          onNameTakenRef.current();
        }
        break;
      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setError("Connection error");
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket disconnected");
        if (reconnectOnVisibleRef.current) {
          reconnectOnVisibleRef.current = false;
          // Небольшая задержка: сервер должен успеть обработать закрытие
          // старого соединения до того, как новое пришлёт join.
          // Без этого сервер ещё видит старое соединение как OPEN и
          // отвечает name_taken, что стирает имя пользователя.
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (connectRef.current) connectRef.current();
          }, 300);
        } else {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (connectRef.current) connectRef.current();
          }, RECONNECT_DELAY_MS);
        }
      };
    } catch (err) {
      setError("Failed to connect");
      console.error("WebSocket connection error:", err);
    }
  }, [url, handleMessage]);

  // Store connect function in ref so it can be called from onclose handler
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const join = useCallback(
    (name: string, roomId?: string) => {
      sendMessage({ type: "join", payload: { name, roomId } });
    },
    [sendMessage]
  );

  const vote = useCallback(
    (voteValue: VoteValue) => {
      sendMessage({ type: "vote", payload: { vote: voteValue } });
    },
    [sendMessage]
  );

  const reset = useCallback(() => {
    sendMessage({ type: "reset" });
  }, [sendMessage]);

  const reveal = useCallback(() => {
    sendMessage({ type: "reveal" });
  }, [sendMessage]);

  const setParticipantCanControl = useCallback(
    (participantId: string, canControl: boolean) => {
      sendMessage({
        type: "set_controller",
        payload: { participantId, canControl },
      });
    },
    [sendMessage]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // При уходе на другую вкладку запоминаем время; при возврате переподключаемся если нужно
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSinceRef.current = Date.now();
        return;
      }
      const hiddenSince = hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      const ws = wsRef.current;

      // Если WS уже отключён пока вкладка была скрыта (браузер throttle-ит таймеры),
      // отменяем throttled таймаут и переподключаемся немедленно
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (connectRef.current) connectRef.current();
        return;
      }

      if (ws.readyState !== WebSocket.OPEN) return;
      const hiddenDuration = hiddenSince != null ? Date.now() - hiddenSince : 0;
      if (hiddenDuration < VISIBILITY_RECONNECT_THRESHOLD_MS) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectOnVisibleRef.current = true;
      ws.close();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const setOnNameTaken = useCallback((callback: () => void) => {
    onNameTakenRef.current = callback;
  }, []);

  return {
    isConnected,
    gameState,
    error,
    join,
    vote,
    reset,
    reveal,
    setOnNameTaken,
    setParticipantCanControl,
  };
};
