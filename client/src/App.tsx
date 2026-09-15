import { useEffect, useMemo, useState } from 'react';
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react';
import { Address, beginCell } from '@ton/core';

type Room = { id: string; name: string; tier: string; entryNano: string; prizeNano: string; endsAt: string; players: number; king: string | null };
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
const fallback: Room[] = [
  { id: 'bronze', name: 'Бронзовый зал', tier: 'BRONZE', entryNano: '100000000', prizeNano: '250000000', endsAt: new Date(Date.now() + 240000).toISOString(), players: 17, king: null },
  { id: 'silver', name: 'Серебряный зал', tier: 'SILVER', entryNano: '500000000', prizeNano: '1500000000', endsAt: new Date(Date.now() + 540000).toISOString(), players: 42, king: null },
  { id: 'gold', name: 'Золотой трон', tier: 'GOLD', entryNano: '1000000000', prizeNano: '4000000000', endsAt: new Date(Date.now() + 900000).toISOString(), players: 8, king: null }
];

function timeLeft(endsAt: string) {
  const seconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function App() {
  const [rooms, setRooms] = useState<Room[]>(fallback);
  const [active, setActive] = useState('gold');
  const [now, setNow] = useState(Date.now());
  const [transactionError, setTransactionError] = useState('');
  const [tonConnectUI] = useTonConnectUI();
  const room = useMemo(() => rooms.find((item) => item.id === active) || rooms[0], [rooms, active]);

  useEffect(() => {
    fetch(`${API}/api/rooms`).then((r) => r.ok ? r.json() : Promise.reject()).then(setRooms).catch(() => undefined);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const socket = new WebSocket(WS);
    socket.onmessage = (event) => { const data = JSON.parse(event.data); if (data.type === 'snapshot') setRooms(data.rooms); };
    return () => { window.clearInterval(timer); socket.close(); };
  }, []);

  async function seize() {
    if (!room) return;
    setTransactionError('');
    const wallet = tonConnectUI.account?.address;
    if (!wallet) { await tonConnectUI.openModal(); return; }
    const destination = import.meta.env.VITE_TREASURY_ADDRESS || wallet;
    const payload = beginCell().storeUint(0x434c415348, 32).storeStringTail(room.id).endCell().toBoc().toString('base64');
    try {
      await tonConnectUI.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: [{ address: Address.parse(destination).toString(), amount: room.entryNano, payload }] });
      await fetch(`${API}/api/rooms/${room.id}/takeover-intent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet }) });
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : 'Транзакция отменена или недоступна.');
    }
  }

  return <main className="app">
    <header><div className="brand"><span className="crown">♛</span><div><b>CROWN CLASH</b><small>KING OF TON</small></div></div><TonConnectButton /></header>
    <section className="hero"><div className="eyebrow">LIVE BATTLE ARENA</div><h1>ЗАХВАТИ <em>ТРОН</em></h1><p>Последний король забирает банк. Войди в комнату и стань легендой.</p></section>
    <nav className="rooms">{rooms.map((item) => <button className={item.id === active ? `room active ${item.tier.toLowerCase()}` : 'room'} onClick={() => setActive(item.id)} key={item.id}><span>{item.tier === 'GOLD' ? '♛' : item.tier === 'SILVER' ? '✦' : '◆'}</span><b>{item.name}</b><small>{Number(item.entryNano) / 1e9} TON вход</small></button>)}</nav>
    {room && <section className="throne"><div className="throne-top"><div><span className="label">ТЕКУЩИЙ ТРОН</span><h2>{room.name}</h2></div><div className="timer"><span>ОКОНЧАНИЕ</span><strong key={now}>{timeLeft(room.endsAt)}</strong></div></div><div className="crown-glow">♛</div><div className="bank"><span>SUPER BANK</span><strong>{(Number(room.prizeNano) / 1e9).toLocaleString('ru-RU')} <i>TON</i></strong><small>{room.players} игроков сражаются за награду</small></div><button className="seize" onClick={seize}>♛ &nbsp; SEIZE THRONE</button>{transactionError && <p className="error" role="alert">{transactionError}</p>}<p className="hint">Вход: {Number(room.entryNano) / 1e9} TON · Комиссия сети оплачивается отдельно</p></section>}
    <footer><span>⚡ LIVE ON TON</span><span>Каждый блок меняет баланс сил</span></footer>
  </main>;
}
export default App;
