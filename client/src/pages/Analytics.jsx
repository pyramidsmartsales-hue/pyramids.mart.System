import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    axios.get("/api/analytics/summary").then(r => setSummary(r.data.data || {}));
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Analytics</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total clients</div>
          <div className="text-2xl">{summary?.totalClients ?? "—"}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Messages today</div>
          <div className="text-2xl">{summary?.messagesToday ?? "—"}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">(Other)</div>
          <div className="text-2xl">—</div>
        </div>
      </div>
    </div>
  );
}
