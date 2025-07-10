import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => {
    const token = localStorage.getItem("token");
    let user = null;
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
      localStorage.removeItem("user");
    }
    return { token: token || null, user };
  });

  const [isAuthReady, setIsAuthReady] = useState(false);

  const login = (newToken, userData) => {
    if (!newToken) throw new Error("Token is required for login");
    const updatedAuthState = { token: newToken, user: userData || null };
    setAuthState(updatedAuthState);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData || null));
  };

  const logout = () => {
    setAuthState({ token: null, user: null });
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  useEffect(() => {
    setIsAuthReady(true);
  }, [authState]);

  if (!isAuthReady) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};