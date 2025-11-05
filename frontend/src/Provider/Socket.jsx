import React, { useMemo } from 'react';
import { io } from "socket.io-client";

const SocketContext = React.createContext(null);

export const useSocket = () => {
    return React.useContext(SocketContext);
}

export const SocketProvider = (props) => {
    // Get socket URL from environment variable
    // In production, socket.io should be on the same URL as the API
    const getSocketUrl = () => {
        if (import.meta.env.VITE_SOCKET_URL) {
            return import.meta.env.VITE_SOCKET_URL;
        }

        if (import.meta.env.DEV) {
            return 'http://localhost:8000';
        }

        // In production, use the same URL as API (socket.io should be attached to Express server)
        const apiUrl = import.meta.env.VITE_API_URL || 'https://tutor-arc.onrender.com';
        return apiUrl;
    };

    const socketUrl = getSocketUrl();
    const socket = useMemo(() => io(socketUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true
    }), [socketUrl]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {props.children}
        </SocketContext.Provider>
    );
}
