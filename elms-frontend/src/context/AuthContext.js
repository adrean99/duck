import { createContext, useState, useEffect } from "react";
import apiClient from '../utils/apiClient';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  token: null,
  setToken: () => {},
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await apiClient.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = response.data;
        if (!userData.id || !userData.name || !userData.directorate) {
          console.warn('Incomplete user data from /api/auth/me:', userData);
          setUser({
            id: userData.id || 'unknown',
            name: userData.name || 'Unknown User',
            role: userData.role || 'Employee',
            directorate: userData.directorate || 'Unknown',
            department: userData.department || 'Unknown',
            phoneNumber: userData.phoneNumber || '',
            profilePicture: userData.profilePicture || '',
            chiefOfficerName: userData.chiefOfficerName || '',
            personNumber: userData.personNumber || '',
            email: userData.email || '',
            directorName: userData.directorName || '',
            departmentalHeadName: userData.departmentalHeadName || '',
            HRDirectorName: userData.HRDirectorName || '',
          });
        } else {
          setUser(userData);
        }
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (err) {
        console.error('Failed to fetch user:', err.message);
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [token]);

  const login = (newToken, userData) => {
    if (!newToken) throw new Error('Token is required for login');
    if (!userData.id || !userData.name || !userData.directorate) {
      console.warn('Incomplete user data for login:', userData);
      userData = {
        id: userData.id || 'unknown',
        name: userData.name || 'Unknown User',
        role: userData.role || 'Employee',
        directorate: userData.directorate || 'Unknown',
        department: userData.department || 'Unknown',
        phoneNumber: userData.phoneNumber || '',
        profilePicture: userData.profilePicture || '',
        chiefOfficerName: userData.chiefOfficerName || '',
        personNumber: userData.personNumber || '',
        email: userData.email || '',
        directorName: userData.directorName || '',
        departmentalHeadName: userData.departmentalHeadName || '',
        HRDirectorName: userData.HRDirectorName || '',
      };
    }
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, setToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};