import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Read initial token & user synchronously from localStorage so refresh keeps user logged in
  const [token, setToken] = useState(() => {
    return localStorage.getItem('wavy_token') || localStorage.getItem('nexchat_token') || null;
  });

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('wavy_user') || localStorage.getItem('nexchat_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  // If user & token are already present in localStorage, no loading delay is needed
  const [loading, setLoading] = useState(() => {
    const savedToken = localStorage.getItem('wavy_token') || localStorage.getItem('nexchat_token');
    const savedUser = localStorage.getItem('wavy_user') || localStorage.getItem('nexchat_user');
    return !(savedToken && savedUser);
  });

  // Verify and refresh user profile with backend in background
  useEffect(() => {
    const fetchMe = async () => {
      const currentToken = token || localStorage.getItem('wavy_token') || localStorage.getItem('nexchat_token');
      if (!currentToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          localStorage.setItem('wavy_user', JSON.stringify(data));
          localStorage.setItem('nexchat_user', JSON.stringify(data));
        } else if (res.status === 401 || res.status === 403) {
          // Token is genuinely invalid or expired
          console.warn('Session expired, logging out');
          logout();
        } else {
          // Temporary server error or 5xx: keep current session
          console.warn('Could not refresh profile from server, keeping local session');
        }
      } catch (err) {
        // Network offline or temporary glitch: DO NOT logout
        console.warn('Auth verification network error, keeping local session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned status ${res.status}. Please check your connection.`);
    }
    if (!res.ok) {
      throw new Error(data?.message || 'Login failed');
    }
    localStorage.setItem('wavy_token', data.token);
    localStorage.setItem('nexchat_token', data.token);
    localStorage.setItem('wavy_user', JSON.stringify(data.user));
    localStorage.setItem('nexchat_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
    return data.user;
  };

  const register = async (userData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned status ${res.status}. Please check your connection.`);
    }
    if (!res.ok) {
      throw new Error(data?.message || 'Registration failed');
    }
    localStorage.setItem('wavy_token', data.token);
    localStorage.setItem('nexchat_token', data.token);
    localStorage.setItem('wavy_user', JSON.stringify(data.user));
    localStorage.setItem('nexchat_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('wavy_token');
    localStorage.removeItem('nexchat_token');
    localStorage.removeItem('wavy_user');
    localStorage.removeItem('nexchat_user');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  const refreshUser = async () => {
    const currentToken = token || localStorage.getItem('wavy_token') || localStorage.getItem('nexchat_token');
    if (!currentToken) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('wavy_user', JSON.stringify(data));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('wavy_user', JSON.stringify(updatedUser));
    localStorage.setItem('nexchat_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
