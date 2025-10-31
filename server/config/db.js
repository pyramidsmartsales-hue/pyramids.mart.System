import mongoose from "mongoose";

function maskUri(uri) {
  if (!uri) return uri;
  try {
    // mask between : and @ (password)
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  } catch (e) {
    return uri;
  }
}

export default function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/pyramidsmart";
  console.log("Attempting MongoDB connection with URI:", maskUri(uri));
  mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log("MongoDB connected");
  }).catch((err) => {
    console.error("MongoDB connection error:", err.message || err);
    process.exit(1);
  });
}
