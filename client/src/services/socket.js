import { io } from "socket.io-client";
export default io(import.meta.env.VITE_API_URL || "/");
