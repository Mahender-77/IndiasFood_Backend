import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface DeliveryUser {
  _id: string;
  username: string;
  email: string;
  role: 'delivery';
  token: string;
}

interface AuthContextType {
  user: DeliveryUser | null;
  token: string | null;
  login: (token: string, userData: DeliveryUser) => void;
  logout: () => void;
  loading: boolean;
  fetchUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<DeliveryUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('deliveryAuthToken');
    const storedUser = localStorage.getItem('deliveryAuthUser');
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, userData: DeliveryUser) => {
    localStorage.setItem('deliveryAuthToken', newToken);
    localStorage.setItem('deliveryAuthUser', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('deliveryAuthToken');
    localStorage.removeItem('deliveryAuthUser');
    setToken(null);
    setUser(null);
  };

  const fetchUserProfile = async () => {
    if (!token) return;
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const { data } = await axios.get(`${API_BASE_URL}/auth/profile`, config);
      // Ensure the fetched user has the 'delivery' role
      if (data.role === 'delivery') {
        setUser({ ...data, token }); // Store the token with the user data for convenience
        localStorage.setItem('deliveryAuthUser', JSON.stringify({ ...data, token }));
      } else {
        logout(); // If not a delivery user, log out
      }
    } catch (error) {
      console.error('Failed to fetch delivery user profile', error);
      logout(); // Logout if token is invalid or expired
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

