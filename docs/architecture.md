# Architecture Overview

- /server: Express REST API + Socket.IO, MongoDB via Mongoose, whatsapp-web.js for WhatsApp integration.
- /client: React + Vite + Tailwind, uses Socket.IO to receive QR and progress events.
