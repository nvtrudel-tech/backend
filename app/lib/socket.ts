import { io } from "socket.io-client";

const SOCKET_URL = "https://backend-tknm.onrender.com";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
});