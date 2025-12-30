"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  transport: string;
  error: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  transport: "N/A",
  error: null,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to the same origin (custom server serves both)
    const socketInstance = io({
      path: "/socket.io", 
    });

    function onConnect() {
      setIsConnected(true);
      setError(null); // Clear error on success
      setTransport(socketInstance.io.engine.transport.name);

      socketInstance.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    function onConnectError(err: any) {
      console.error("Socket Connection Error:", err);
      setError(err.message || "Connection Failed");
    }

    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("connect_error", onConnectError);

    setSocket(socketInstance);

    // Initial check in case it connected immediately
    if (socketInstance.connected) {
      onConnect();
    }

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("disconnect", onDisconnect);
      socketInstance.off("connect_error", onConnectError);
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, transport, error }}>
      {children}
    </SocketContext.Provider>
  );
};
