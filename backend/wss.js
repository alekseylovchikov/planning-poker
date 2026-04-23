import { WebSocketServer } from 'ws';
import { createdServer as server } from './createdServer.js';
import { logger } from './utils/logger.js';

// Security: Validate origin to prevent CSRF attacks
const getAllowedOrigins = () => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
  ];

  if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
  }

  // In production, add configured domain(s)
  if (process.env.PROD_URL) {
    allowedOrigins.push(process.env.PROD_URL);
  }

  return allowedOrigins;
};

export const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin, req }, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests without origin (e.g., native clients) or matching allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(true);
    } else {
      logger.warn(
        `Rejected WebSocket connection from unauthorized origin: ${origin}`,
      );

      callback(false, 403, 'Unauthorized origin');
    }
  },
});
