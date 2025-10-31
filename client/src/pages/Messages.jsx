import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { SocketContext } from "../App";

export default function Messages() {
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState([]);
  const socket = useContext(SocketContext);

  useEffect(() => {
    fetchMessages();
    socket.on("wa:progress", (p) => {
      // we can update UI based on progress
      console.log("progress", p);
    });
    return () => socket.off("wa:progress");
  }, []);

  function fetchMessages() {
    axios.get("/api/messages").then(r => setMessages(r.data.data || []));
  }

  async function sendBroadcast(e) {
    e.preventDefault();
    const form = new FormData();
    form.append("body", body);
    const res = await axios.post("/api/messages", form, { headers: { "Content-Type": "multipart/form-data" }});
    setBody("");
    fetchMessages();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Messages</h2>
      <form onSubmit={sendBroadcast} className="mb-4">
        <textarea className="w-full p-2 border mb-2" value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Write message..." />
        <div>
          <input type="file" name="file" />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded mt-2">Send Broadcast</button>
      </form>

      <div className="space-y-2">
        {messages.map(m => (
          <div key={m._id} className="p-3 bg-white rounded shadow">
            <div className="text-sm text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
            <div className="font-medium mt-1">{m.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
