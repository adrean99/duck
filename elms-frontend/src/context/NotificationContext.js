import { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications,] = useState([]);

  const addNotification = (message, type) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => console.log("WebSocket connected for notifications"));
    socket.on("leaveStatusUpdate", (updatedLeave) => {
      setNotifications((prev) => [
        ...prev,
        { message: `Your leave request has been ${updatedLeave.status.toLowerCase()}`, timestamp: new Date() },
      ]);
    });
    socket.on("rosterUpdate", (data) => {
      setNotifications((prev) => [
        ...prev,
        { message: `Your leave period has been ${data.status.toLowerCase()}`, timestamp: new Date() },
      ]);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <NotificationContext.Provider 
    value={{ notifications, setNotifications, addNotification, removeNotification}}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);