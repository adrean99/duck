import { createContext, useState, useEffect } from "react";


export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    return {
      token: token ? token : null,
      user: user ? JSON.parse(user) : null,
    };
  });
  
  const [notifications, setNotifications] = useState([]);

  
  const login = (newToken, userData) => {
    console.log("🔐 Logging in with token:", newToken, "User:", userData);
    setAuthState({ token: newToken, user: userData });
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    
  };

  const logout = () => {
    console.log("🚪 Logging out...");
    setAuthState({ token: null, user: null });
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
  };

  useEffect(() => {
    console.log("AuthContext state updated:", authState);
  }, [authState]);

  console.log("AuthContext rendering with:", authState);

  return (
    <AuthContext.Provider value={{  authState, notifications, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
