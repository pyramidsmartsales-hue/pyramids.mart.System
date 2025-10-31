import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    axios.get("/api/analytics/summary").then(r => setSummary(r.data.data)).catch(() => {});
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total clients</div>
          <div className="text-2xl">{summary ? summary.totalClients : "—"}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Messages today</div>
          <div className="text-2xl">{summary ? summary.messagesToday : "—"}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Placeholder</div>
          <div className="text-2xl">—</div>
        </div>
      </div>
    </div>
  );
}
