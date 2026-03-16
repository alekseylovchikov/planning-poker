// WebSocket URL - автоматически определяет протокол (ws/wss) на основе текущего протокола страницы
export const getWebSocketUrl = () => {
    const envUrl = import.meta.env.VITE_WS_URL;
    if (envUrl) {
        // Если URL начинается с ws:// или wss://, используем как есть
        if (envUrl.startsWith("ws://") || envUrl.startsWith("wss://")) {
            return envUrl;
        }
        // Если URL без протокола, определяем автоматически
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${envUrl}`;
    }

    // Автоматическое определение на основе текущего домена (для Railway и других платформ)
    // Если приложение работает на продакшене, используем тот же домен для WebSocket
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalhost) {
        // Для разработки используем ws://localhost
        return window.location.protocol === "https:"
            ? "wss://localhost:8080"
            : "ws://localhost:8080";
    }

    // Для продакшена используем тот же домен и порт (Railway обычно использует тот же домен)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = window.location.port ? `:${window.location.port}` : "";
    return `${protocol}//${hostname}${port}`;
};
