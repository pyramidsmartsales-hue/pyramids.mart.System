import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  area: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastStatus: { type: String, enum: ["pending","sent","failed","unknown"], default: "unknown" }
});

export default mongoose.model("Client", ClientSchema);
