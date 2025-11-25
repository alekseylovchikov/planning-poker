import { useEffect, useRef, useState, useCallback } from "react";
import type { GameState, VoteValue, WebSocketMessage } from "../types";

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
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (connectRef.current) {
            connectRef.current();
          }
        }, 3000);
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

  useEffect(() => {
    // Отложенный вызов для избежания синхронного setState в эффекте
    const timeoutId = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

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
  };
};
