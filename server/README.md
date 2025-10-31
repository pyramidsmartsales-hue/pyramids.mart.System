# Server (Express + MongoDB + whatsapp-web.js)

## Setup
1. Install: `cd server && npm install`
2. Copy `.env.example` to `.env` and edit `MONGODB_URI`.
3. Run server: `npm run dev`

## Notes
- QR is emitted via Socket.IO events: `wa:qr`, `wa:ready`.
- Broadcast can be triggered from socket events or REST endpoints.
