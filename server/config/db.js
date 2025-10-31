// server/config/db.js
import mongoose from "mongoose";

function maskUri(uri) {
  if (!uri) return uri;
  try {
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  } catch (e) {
    return uri;
  }
}

export default async function connectDB() {
  // Expect MONGODB_URI from environment in production (Render)
  const envUri = process.env.MONGODB_URI && process.env.MONGODB_URI.trim();
  const isProduction = process.env.NODE_ENV === "production";

  let uri = envUri;

  if (!uri) {
    if (isProduction) {
      // In production we must not fallback to localhost silently
      console.error(
        "FATAL: MONGODB_URI is not defined in environment (production). Aborting DB connect."
      );
      // Throw so process shows clear failure (optional: remove exit if you prefer retry)
      throw new Error("MONGODB_URI not set in production environment");
    } else {
      // Local development fallback (optional)
      uri = "mongodb://127.0.0.1:27017/pyramidsmart";
      console.warn("Using local MongoDB fallback:", uri);
    }
  }

  console.log("Attempting MongoDB connection with URI:", maskUri(uri));

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message || err);
    // in production you may want to exit, in dev maybe not
    if (isProduction) {
      // crash process in production so Render restarts or you notice the problem
      process.exit(1);
    }
    // otherwise rethrow so the caller can handle it or nodemon can show error
    throw err;
  }
}
