import React from "react";

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="w-64 bg-white p-4 border-r">
      <img src="/logo.png" alt="logo" className="w-40 mx-auto mb-4" />
      <nav>
        <ul>
          <li className="mb-2 cursor-pointer" onClick={() => onNavigate("dashboard")}>Dashboard</li>
          <li className="mb-2 cursor-pointer" onClick={() => onNavigate("clients")}>Clients</li>
          <li className="mb-2 cursor-pointer" onClick={() => onNavigate("messages")}>Messages</li>
          <li className="mb-2 cursor-pointer" onClick={() => onNavigate("templates")}>Templates</li>
          <li className="mb-2 cursor-pointer" onClick={() => onNavigate("analytics")}>Analytics</li>
          <li className="mb-2 cursor-pointer" onClick={() => onNavigate("settings")}>Settings</li>
        </ul>
      </nav>
    </aside>
  );
}
