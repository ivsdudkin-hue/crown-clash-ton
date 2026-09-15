# Crown Clash / King of TON

Минимальный full-stack Telegram Mini App для соревнования за трон в сети TON. Клиент — React 18 + Vite, сервер — Node.js ESM + Express, обновления комнат идут по WebSocket. Реальное подтверждение платежей намеренно не реализовано: `/api/payments/confirm` отвечает `501`.

## Запуск

```bash
npm install
cp .env.example .env
docker compose up -d redis # необязательно
npm run dev --workspace server
npm run dev --workspace client
```

Для PowerShell вместо `cp` используйте `Copy-Item .env.example .env`. Сборка клиента: `npm run build --workspace client`.

## Переменные

`PORT`, `CLIENT_ORIGIN`, `REDIS_URL` используются сервером. `VITE_API_URL`, `VITE_WS_URL` и необязательный `VITE_TREASURY_ADDRESS` используются клиентом. В манифесте TonConnect оставлены безопасные URL-заглушки — перед публикацией замените их на HTTPS URL приложения и иконки.

## API и протокол

`GET /health`, `GET /api/rooms`, `GET /api/rooms/:roomId`, `POST /api/rooms/:roomId/takeover-intent`, `POST /api/payments/confirm`. WebSocket доступен на `/ws` и отправляет `snapshot`, `tick`, `room_finished`.

Кнопка **SEIZE THRONE** подключает TonConnect и вызывает `sendTransaction`: сумма указывается в nanotons, а payload — BOC Cell с идентификатором комнаты. Это только клиентский intent; сервер не считает платеж подтверждённым без отдельной on-chain верификации.
