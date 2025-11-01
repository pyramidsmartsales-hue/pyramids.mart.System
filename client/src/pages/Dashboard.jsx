import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || "";
    const url = `${base}/api/analytics/summary`;
    let mounted = true;

    setLoading(true);
    axios.get(url)
      .then(r => { if (mounted) setSummary(r.data?.data ?? null); })
      .catch((e) => {
        // avoid noisy console in production — keep for debugging
        console.warn("dashboard summary fetch failed", e?.message || e);
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <div className="text-sm text-gray-500">Total clients</div>
          <div className="text-3xl font-bold">{loading ? "..." : (summary?.totalClients ?? "—")}</div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <div className="text-sm text-gray-500">Messages today</div>
          <div className="text-3xl font-bold">{loading ? "..." : (summary?.messagesToday ?? "—")}</div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <div className="text-sm text-gray-500">Placeholder</div>
          <div className="text-3xl font-bold">—</div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
        <p className="text-sm text-gray-500">No recent activity yet.</p>
      </div>
    </div>
  );
}
