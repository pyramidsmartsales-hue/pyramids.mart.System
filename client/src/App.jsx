// client/src/App.jsx
import React, { useEffect, useState } from "react";
import socket from "./services/socket"; // <- استخدم ملف الخدمة المركزي
import ClientsPage from "./pages/Clients";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Templates from "./pages/Templates";
import Analytics from "./pages/Analytics";
import Sidebar from "./components/Sidebar";
import QRModal from "./components/QRModal";

export const SocketContext = React.createContext(socket);

export default function App() {
  const [qr, setQr] = useState(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState("dashboard");

  useEffect(() => {
    // event listeners
    socket.on("wa:qr", (q) => setQr(q));
    socket.on("wa:ready", () => { setReady(true); setQr(null); });
    socket.on("wa:init_error", (e) => console.warn("wa init error", e));

    // If socket connects/disconnects, update ready state
    socket.on("connect", () => {
      console.log("socket connected (client):", socket.id);
      setReady(true);
    });
    socket.on("disconnect", () => {
      console.log("socket disconnected (client)");
      setReady(false);
    });

    return () => {
      socket.off("wa:qr");
      socket.off("wa:ready");
      socket.off("wa:init_error");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <div className="min-h-screen flex">
        <Sidebar onNavigate={setRoute} />
        <div className="flex-1 p-6">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Pyramids Mart — Broadcast Dashboard</h1>
            <div>
              <button onClick={() => socket.emit("request:qr")} className="px-3 py-1 mr-2 bg-yellow-200 rounded">Show QR</button>
              <span className={`px-3 py-1 rounded ${ready ? "bg-green-100" : "bg-red-100"}`}>{ready ? "Connected" : "Disconnected"}</span>
            </div>
          </header>

          <main>
            {route === "dashboard" && <Dashboard />}
            {route === "clients" && <ClientsPage />}
            {route === "messages" && <Messages />}
            {route === "templates" && <Templates />}
            {route === "analytics" && <Analytics />}
          </main>
        </div>
        <QRModal qr={qr} onClose={() => setQr(null)} />
      </div>
    </SocketContext.Provider>
  );
}
