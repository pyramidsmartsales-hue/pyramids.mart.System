import React from "react";

function IconHome() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z"/></svg>
  );
}
function IconUsers() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
  );
}
function IconChat() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  );
}
function IconTemplate() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="14" rx="2" ry="2" strokeWidth="1.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h8M8 11h8"/></svg>
  );
}
function IconAnalytics() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3v18h18"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 13v6M12 7v12M17 10v9"/></svg>
  );
}

export default function Sidebar({ route, onNavigate }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: <IconHome /> },
    { id: "clients", label: "Clients", icon: <IconUsers /> },
    { id: "messages", label: "Messages", icon: <IconChat /> },
    { id: "templates", label: "Templates", icon: <IconTemplate /> },
    { id: "analytics", label: "Analytics", icon: <IconAnalytics /> },
    { id: "settings", label: "Settings", icon: <IconTemplate /> },
  ];

  return (
    <aside className="w-72 min-h-screen bg-white border-r shadow-sm hidden md:flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-lg font-semibold text-teal-600">Pyramids<span className="text-violet-600">Mart</span></div>
            <div className="text-xs text-gray-400">Broadcast Dashboard</div>
          </div>
        </div>
      </div>

      <nav className="p-4 flex-1">
        <ul className="space-y-1">
          {items.map((it) => {
            const active = route === it.id;
            return (
              <li key={it.id}>
                <button
                  onClick={() => onNavigate(it.id)}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    active ? "bg-teal-50 text-teal-600" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="flex-none">{it.icon}</span>
                  <span className="font-medium">{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t text-sm text-gray-500">
        © {new Date().getFullYear()} Pyramids Mart
      </div>
    </aside>
  );
}
