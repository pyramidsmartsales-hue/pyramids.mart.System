// client/src/components/Sidebar.jsx
import React from "react";

function IconHome() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z"/></svg>); }
function IconUsers() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>); }
function IconChat() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>); }
function IconTemplate() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="14" rx="2" ry="2" strokeWidth="1.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h8M8 11h8"/></svg>); }
function IconAnalytics() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3v18h18"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 13v6M12 7v12M17 10v9"/></svg>); }
function IconOverview() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12h10M7 7h10M7 17h6"/></svg>); }
function IconProducts() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7l9-4 9 4v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 22V10"/></svg>); }
function IconInventory() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M3 12h18M3 17h18"/></svg>); }
function IconSales() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v8M8 12h8"/><circle cx="12" cy="12" r="10" strokeWidth="1.5"/></svg>); }
function IconSuppliers() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM4 20v-1c0-2.21 3.58-4 8-4s8 1.79 8 4v1"/></svg>); }
function IconPurchases() { return (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="14" rx="2" ry="2" strokeWidth="1.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 9h10M7 13h10"/></svg>); }

export default function Sidebar({ route, onNavigate }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: <IconHome /> },
    { id: "overview", label: "Overview", icon: <IconOverview /> },
    { id: "products", label: "Products", icon: <IconProducts /> },
    { id: "inventory", label: "Inventory", icon: <IconInventory /> }, // new
    { id: "sales", label: "Sales (POS)", icon: <IconSales /> },        // new
    { id: "suppliers", label: "Suppliers", icon: <IconSuppliers /> },// new
    { id: "purchases", label: "Purchases", icon: <IconPurchases /> },// new
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
