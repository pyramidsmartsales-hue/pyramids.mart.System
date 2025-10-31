import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    axios.get("/api/templates").then(r => setTemplates(r.data.data || []));
  }, []);

  function addTemplate(e) {
    e.preventDefault();
    axios.post("/api/templates", { name, body }).then(() => {
      setName(""); setBody("");
      axios.get("/api/templates").then(r => setTemplates(r.data.data || []));
    });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Templates</h2>
      <form onSubmit={addTemplate} className="mb-4">
        <input className="p-2 border w-full mb-2" placeholder="Template name" value={name} onChange={e=>setName(e.target.value)} />
        <textarea className="p-2 border w-full mb-2" rows={3} placeholder="Template body" value={body} onChange={e=>setBody(e.target.value)} />
        <button className="px-4 py-2 bg-green-600 text-white rounded">Save Template</button>
      </form>

      <div className="space-y-2">
        {templates.map(t => (
          <div className="p-3 bg-white rounded shadow" key={t._id}>
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-gray-600">{t.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
