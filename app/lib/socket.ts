import { io } from "socket.io-client";

const SOCKET_URL = "http://172.20.10.3:6000";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
});