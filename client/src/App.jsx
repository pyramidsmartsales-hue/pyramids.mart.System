// client/src/App.jsx
import React, { useEffect, useState } from "react";
import socket from "./services/socket";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Overview from "./pages/Overview";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import QRModal from "./components/QRModal";

export const SocketContext = React.createContext(socket);

export default function App() {
  const [qr, setQr] = useState(null);
  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState("dashboard");

  useEffect(() => {
    socket.on("wa:qr", (q) => setQr(q));
    socket.on("wa:ready", () => { setConnected(true); setQr(null); });
    socket.on("wa:disconnected", () => setConnected(false));
    socket.on("connect", () => { console.log("socket connected (client):", socket.id); setConnected(true); });
    socket.on("disconnect", () => { console.log("socket disconnected (client)"); setConnected(false); });

    return () => {
      socket.off("wa:qr");
      socket.off("wa:ready");
      socket.off("wa:disconnected");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <div className="min-h-screen flex bg-gray-50 text-gray-800 font-inter">
        <Sidebar route={route} onNavigate={setRoute} />
        <div className="flex-1">
          <Header
            connected={connected}
            onShowQR={() => socket.emit("request:qr")}
            onDisconnect={() => socket.emit("request:logout")}
          />
          <main className="p-6">
            {route === "dashboard" && <Dashboard />}
            {route === "overview" && <Overview />}
            {route === "products" && <Products />}
            {route === "inventory" && <Inventory />}
            {route === "sales" && <Sales />}
            {route === "suppliers" && <Suppliers />}
            {route === "purchases" && <Purchases />}
            {route === "clients" && <Clients />}
          </main>
        </div>

        <QRModal qr={qr} onClose={() => setQr(null)} />
      </div>
    </SocketContext.Provider>
  );
}
