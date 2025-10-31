import React, { useEffect, useState } from "react";
import axios from "axios";

function ClientRow({ c, onSelect, selected }) {
  return (
    <tr>
      <td className="p-2"><input type="checkbox" checked={selected} onChange={(e) => onSelect(c._id, e.target.checked)} /></td>
      <td className="p-2">{c.name}</td>
      <td className="p-2">{c.phone}</td>
      <td className="p-2">{c.area}</td>
      <td className="p-2">{c.notes}</td>
    </tr>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState({});
  const [form, setForm] = useState({ name: "", phone: "", area: "", notes: "" });

  function fetchClients() {
    axios.get("/api/clients").then(r => setClients(r.data.data || []));
  }

  useEffect(() => {
    fetchClients();
  }, []);

  function toggleSelect(id, value) {
    setSelected(s => ({ ...s, [id]: value }));
  }

  function addClient(e) {
    e.preventDefault();
    axios.post("/api/clients", form).then(() => {
      setForm({ name: "", phone: "", area: "", notes: "" });
      fetchClients();
    });
  }

  function selectAll(checked) {
    const s = {};
    clients.forEach(c => s[c._id] = checked);
    setSelected(s);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Clients</h2>

      <form onSubmit={addClient} className="mb-4 grid grid-cols-4 gap-2">
        <input className="p-2 border" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input className="p-2 border" placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        <input className="p-2 border" placeholder="Area" value={form.area} onChange={e => setForm({...form, area: e.target.value})} />
        <input className="p-2 border" placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        <div />
        <div />
        <div />
        <button className="px-4 py-2 bg-green-600 text-white rounded">Add Client</button>
      </form>

      <div className="mb-2">
        <button className="px-3 py-1 bg-gray-200 mr-2" onClick={() => selectAll(true)}>Select All</button>
        <button className="px-3 py-1 bg-gray-200" onClick={() => selectAll(false)}>Clear</button>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-600">
              <th className="p-2">#</th>
              <th className="p-2">Name</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Area</th>
              <th className="p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <ClientRow key={c._id} c={c} onSelect={toggleSelect} selected={!!selected[c._id]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
