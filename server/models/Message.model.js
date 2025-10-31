import mongoose from "mongoose";

const RecipientStatusSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  phone: String,
  status: { type: String, enum: ["pending","sent","failed"], default: "pending" },
  error: String,
  sentAt: Date
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  subject: String,
  body: String,
  mediaUrl: String,
  scheduledAt: Date,
  createdAt: { type: Date, default: Date.now },
  recipients: [RecipientStatusSchema],
  overallStatus: { type: String, enum: ["pending","processing","done","failed"], default: "pending" }
});

export default mongoose.model("Message", MessageSchema);
