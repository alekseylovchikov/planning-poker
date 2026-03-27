import { WebSocketServer } from 'ws';
import { createdServer as server } from './createdServer.js';

export const wss = new WebSocketServer({ server });
