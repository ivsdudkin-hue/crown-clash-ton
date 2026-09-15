import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
const duration = 15 * 60 * 1000;
const rooms = new Map([
  ['bronze', { id: 'bronze', name: 'Бронзовый зал', tier: 'BRONZE', entryNano: '100000000', prizeNano: '250000000', endsAt: new Date(Date.now() + duration).toISOString(), players: 17, king: null }],
  ['silver', { id: 'silver', name: 'Серебряный зал', tier: 'SILVER', entryNano: '500000000', prizeNano: '1500000000', endsAt: new Date(Date.now() + duration * 2).toISOString(), players: 42, king: null }],
  ['gold', { id: 'gold', name: 'Золотой трон', tier: 'GOLD', entryNano: '1000000000', prizeNano: '4000000000', endsAt: new Date(Date.now() + duration * 3).toISOString(), players: 8, king: null }]
]);
let redis;
if (process.env.REDIS_URL) { redis = new Redis(process.env.REDIS_URL); redis.on('error', () => undefined); }
const snapshot = () => [...rooms.values()];
app.get('/health', (_req, res) => res.json({ ok: true, service: 'crown-clash' }));
app.get('/api/rooms', (_req, res) => res.json(snapshot()));
app.get('/api/rooms/:roomId', (req, res) => { const room = rooms.get(req.params.roomId); room ? res.json(room) : res.status(404).json({ error: 'Room not found' }); });
app.post('/api/rooms/:roomId/takeover-intent', async (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!req.body?.wallet) return res.status(400).json({ error: 'wallet is required' });
  if (redis) await redis.lpush(`room:${room.id}:intents`, JSON.stringify({ wallet: req.body.wallet, at: Date.now() }));
  room.king = req.body.wallet; room.players += 1; broadcast({ type: 'snapshot', rooms: snapshot() });
  res.status(202).json({ accepted: true, message: 'Intent queued; confirm payment on-chain.' });
});
app.post('/api/payments/confirm', (_req, res) => res.status(501).json({ error: 'On-chain payment verification is not implemented yet.' }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
function broadcast(message) { const data = JSON.stringify(message); clients.forEach((client) => { if (client.readyState === 1) client.send(data); }); }
wss.on('connection', (socket) => { clients.add(socket); socket.send(JSON.stringify({ type: 'snapshot', rooms: snapshot() })); socket.on('close', () => clients.delete(socket)); });
setInterval(() => { broadcast({ type: 'tick', at: new Date().toISOString(), rooms: snapshot() }); for (const room of rooms.values()) if (Date.now() >= new Date(room.endsAt).getTime()) { broadcast({ type: 'room_finished', roomId: room.id }); room.endsAt = new Date(Date.now() + duration).toISOString(); room.king = null; } }, 1000);
const port = Number(process.env.PORT || 3001);
server.listen(port, () => console.log(`Crown Clash API listening on :${port}`));
