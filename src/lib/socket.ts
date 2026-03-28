import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    let socketUrl = "";
    if (typeof window !== "undefined") {
      const { hostname, protocol, port } = window.location;
      // If we are on a dev port (like 3001) but the socket server is on 3000
      if ((hostname === "localhost" || hostname.startsWith("192.168.")) && port !== "3000") {
        socketUrl = `${protocol}//${hostname}:3000`;
      } else {
        socketUrl = window.location.origin;
      }
    } else {
      socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
    }

    socket = io(socketUrl, {
      path: "/api/socket/io",
      addTrailingSlash: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    
    socket.on("connect", () => {
      console.log("Connected to Socket.io server");
    });
    
    socket.on("disconnect", () => {
      console.log("Disconnected from Socket.io server");
    });
  }
  return socket;
};
