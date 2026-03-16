import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { NameInput } from "./components/NameInput";
import { ParticipantsList } from "./components/ParticipantsList";
import { VotingCards } from "./components/VotingCards";
import { VotingTable } from "./components/VotingTable";
import { useWebSocket } from "./hooks/useWebSocket";
import { sanitizeName, getWebSocketUrl } from "./lib";
import type { VoteValue } from "./types";
import styles from "./App.module.scss";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { ToastContainer, toast } from 'react-toastify';
import { useAudio } from "./features/audio/usePlayAudio";
import { SoundButton } from "./features/audio/SoundButton";

const WS_URL = getWebSocketUrl();

function App() {
  // Санитизируем имя при загрузке из localStorage
  const storedName = localStorage.getItem("userName");
  const [userName, setUserName] = useState<string | null>(
    storedName ? sanitizeName(storedName) : null,
  );
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("room");
    }
    return null;
  });
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const hasAttemptedJoinRef = useRef(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('isMuted') === 'true';
  });
  const { playAudio } = useAudio();

  const {
    isConnected,
    gameState,
    error,
    join,
    vote,
    reset,
    reveal,
    setOnNameTaken,
    setParticipantCanControl,
  } = useWebSocket(WS_URL);

  // Обновляем URL когда получаем roomId от сервера
  useEffect(() => {
    if (gameState.roomId && gameState.roomId !== roomId) {
      const newRoomId = gameState.roomId ?? null;
      setTimeout(() => {
        setRoomId(newRoomId);
      }, 0);

      const params = new URLSearchParams(window.location.search);

      params.set("room", gameState.roomId);
      window.history.pushState({}, "", `?${params.toString()}`);
    }
  }, [gameState.roomId, roomId]);

  useEffect(() => {
    setOnNameTaken(() => {
      setUserName(null);
      localStorage.removeItem("userName");
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
    });
  }, [setOnNameTaken]);

  // Автоматическое присоединение при подключении или переподключении
  useEffect(() => {
    if (userName && isConnected && !hasAttemptedJoinRef.current) {
      hasAttemptedJoinRef.current = true;
      setTimeout(() => {
        setIsJoining(true);
        join(userName, roomId || undefined);
      }, 0);
    }
  }, [userName, isConnected, join, roomId]);

  // Сбрасываем флаг присоединения при отключении для возможности переподключения
  useEffect(() => {
    if (!isConnected) {
      hasAttemptedJoinRef.current = false;
      setTimeout(() => {
        setIsJoining(false);
      }, 0);
    }
  }, [isConnected]);

  const handleNameSubmit = (name: string) => {
    // Имя уже санитизировано в NameInput, но санитизируем еще раз для безопасности
    const sanitizedName = sanitizeName(name);
    setUserName(sanitizedName);
    localStorage.setItem("userName", sanitizedName);
    setIsJoining(true);
    if (isConnected) {
      join(sanitizedName, roomId || undefined);
    }
  };

  const handleVote = () => {
    if (selectedVote) {
      vote(selectedVote);
      setSelectedVote(null);
    }
  };

  // Сравниваем санитизированные имена для поиска текущего участника
  const sanitizedUserName = userName ? sanitizeName(userName) : null;
  const currentParticipant = gameState.participants.find(
    (p) => sanitizeName(p.name) === sanitizedUserName,
  );

  // Сбрасываем выбранный голос только когда голосование действительно сброшено на сервере
  // Отслеживаем изменение hasVoted с true на false - это означает reset
  const prevHasVotedRef = useRef(currentParticipant?.hasVoted ?? false);
  useEffect(() => {
    const currentHasVoted = currentParticipant?.hasVoted ?? false;
    // Если hasVoted изменился с true на false - произошел reset, сбрасываем выбранную карту
    if (prevHasVotedRef.current === true && currentHasVoted === false) {
      setTimeout(() => {
        setSelectedVote(null);
      }, 0);
    }
    prevHasVotedRef.current = currentHasVoted;
  }, [currentParticipant?.hasVoted]);

  // Эффект для запуска фейерверка при совпадении всех оценок
  const hasFiredFireworksRef = useRef(false);

  useEffect(() => {
    if (!gameState.votesRevealed) {
      hasFiredFireworksRef.current = false;
      return;
    }

    if (gameState.votesRevealed && !hasFiredFireworksRef.current) {
      // Получаем голоса только тех, кто проголосовал
      const validVotes = gameState.participants
        .filter((p) => p.hasVoted && p.vote)
        .map((p) => p.vote);

      if (validVotes.length > 0) {
        const firstVote = validVotes[0];
        const allEqual = validVotes.every((v) => v === firstVote);

        if (allEqual) {
          hasFiredFireworksRef.current = true;

          // Запускаем фейерверк
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 50, // Увеличиваем z-index чтобы было видно поверх интерфейса
          };

          const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
          };

          const interval = window.setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // since particles fall down, start a bit higher than random
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
          }, 250);

          return () => clearInterval(interval);
        }
      }
    }
  }, [gameState.votesRevealed, gameState.participants]);

  // Запрос разрешения на уведомления при входе в комнату
  const hasRequestedNotificationRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!gameState.roomId || hasRequestedNotificationRef.current) return;
    hasRequestedNotificationRef.current = true;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [gameState.roomId]);

  // Браузерное уведомление при открытии карт
  const prevVotesRevealedRef = useRef(gameState.votesRevealed);
  const originalTitleRef = useRef<string | null>(null);
  const titleIntervalRef = useRef<number | null>(null);

  const clearTitleAttention = () => {
    if (titleIntervalRef.current !== null) {
      window.clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    if (typeof document !== "undefined") {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = null;
      }
    }
  };

  // Отображение количества проголосовавших в заголовке вкладки во время голосования
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (gameState.votesRevealed) {
      // Во время показа карт управляем заголовком в другом эффекте
      return;
    }

    const votedCount = gameState.participants.filter(
      (p) => p.hasVoted && p.vote,
    ).length;

    document.title =
      votedCount > 0 ? `${votedCount} – Planning Poker` : "Planning Poker";
  }, [gameState.participants, gameState.votesRevealed]);

  const handleMuteToggle = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('isMuted', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const prev = prevVotesRevealedRef.current;
    const current = gameState.votesRevealed;
    prevVotesRevealedRef.current = current;
    if (!prev && !current) {
      clearTitleAttention();
      return;
    }

    if (!prev && current) {
      // Звук при открытии карт в зависимости от совпадения оценок
      const validVotes = gameState.participants
        .filter((p) => p.hasVoted && p.vote)
        .map((p) => p.vote);

      if (validVotes.length > 0) {
        const firstVote = validVotes[0];
        const allEqual = validVotes.every((v) => v === firstVote);

        if (!isMuted) {
          playAudio(allEqual);
        }
      }

      // Если вкладка не активна или браузерные уведомления недоступны/запрещены,
      // мигаем заголовком вкладки, чтобы привлечь внимание
      if (typeof document !== "undefined") {
        if (originalTitleRef.current === null) {
          originalTitleRef.current = document.title;
        }
        clearTitleAttention();
        // const attentionTitle = "Карты открыты! – Planning Poker";
        // let isAttentionTitle = false;
        titleIntervalRef.current = window.setInterval(() => {
          document.title = originalTitleRef.current || "Planning Poker";
          // isAttentionTitle = !isAttentionTitle;
        }, 1000);

        const handleVisibilityChange = () => {
          if (!document.hidden) {
            clearTitleAttention();
            document.removeEventListener(
              "visibilitychange",
              handleVisibilityChange,
            );
          }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
      }

      const show = () => {
        const n = new Notification("Planning Poker", {
          body: "Карты открыты!",
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      };
      if (Notification.permission === "granted") {
        show();
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") show();
        });
      }
    }
  }, [gameState.votesRevealed, gameState.participants, isMuted, playAudio]);

  // Если пользователь не ввел имя, показываем форму ввода
  if (!userName) {
    return (
      <NameInput
        onSubmit={handleNameSubmit}
        error={error}
        isLoading={isJoining}
      />
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <h1 className={styles.title}>Planning Poker</h1>
        <div className={styles.connectionStatus}>
          {gameState.roomId && (
            <span
              className={styles.roomId}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Ссылка скопирована!");
              }}
            >
              Комната: {gameState.roomId} (нажми чтобы скопировать)
            </span>
          )}

          <SoundButton isMuted={isMuted} onClick={handleMuteToggle} />

          <span
            className={`${styles.statusIndicator} ${
              isConnected ? styles.connected : styles.disconnected
            }`}
          />
          <span>{isConnected ? "Подключено" : "Подключение..."}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <ParticipantsList
            participants={gameState.participants}
            currentUserName={userName}
            isCreator={gameState.isCreator || false}
            onToggleController={setParticipantCanControl}
          />
        </div>

        <div className={styles.main}>
          <Card>
            <CardHeader>
              <CardTitle>Оценки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={styles.votingSection}>
                <VotingCards
                  selectedVote={selectedVote}
                  onSelectVote={setSelectedVote}
                  onVote={handleVote}
                  hasVoted={currentParticipant?.hasVoted || false}
                  votesRevealed={gameState.votesRevealed}
                />
              </div>
            </CardContent>
          </Card>

          <div className={styles.tableSection}>
            <VotingTable
              participants={gameState.participants}
              votesRevealed={gameState.votesRevealed}
              onReset={reset}
              onReveal={reveal}
              canControlVotes={gameState.canControlVotes || false}
            />
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}

export default App;
