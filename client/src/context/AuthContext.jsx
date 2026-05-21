import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Create dedicated axios instance for all app requests
export const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 15000
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('mp_access_token') || null);
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('mp_refresh_token') || null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('mp_theme') || 'dark');

  // Sync token changes to headers
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('mp_access_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('mp_access_token');
    }
  }, [token]);

  // Sync refresh token
  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('mp_refresh_token', refreshToken);
    } else {
      localStorage.removeItem('mp_refresh_token');
    }
  }, [refreshToken]);

  // Theme support
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
    localStorage.setItem('mp_theme', theme);
  }, [theme]);

  // Bootstrapping: Try checking token validity on refresh
  useEffect(() => {
    const bootstrapAuth = async () => {
      const storedUser = localStorage.getItem('mp_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          localStorage.removeItem('mp_user');
        }
      }
      setLoading(false);
    };
    bootstrapAuth();
  }, []);

  // Axios Interceptor for automated token-refresh (401 triggers refresh, then retries original request)
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Check if error is 401 and request hasn't been retried yet
        if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
          originalRequest._retry = true;
          
          try {
            console.log('[auth-interceptor] Access token expired. Attempting token refresh...');
            const refreshRes = await axios.post('http://localhost:5000/api/auth/refresh', {
              refreshToken
            });
            
            const newAccessToken = refreshRes.data.accessToken;
            setToken(newAccessToken);
            
            // Re-configure header & retry failed request
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            console.error('[auth-interceptor] Refresh token validation expired. Logging out user.', refreshError);
            logout(true); // silent logout due to session expiry
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [refreshToken]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken: newRefresh, user: userData } = response.data;
      
      setToken(accessToken);
      setRefreshToken(newRefresh);
      setUser(userData);
      localStorage.setItem('mp_user', JSON.stringify(userData));
      
      toast.success('Successfully logged in! Welcome back.');
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed. Please verify credentials.';
      toast.error(msg);
      throw error;
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { accessToken, refreshToken: newRefresh, user: userData } = response.data;
      
      setToken(accessToken);
      setRefreshToken(newRefresh);
      setUser(userData);
      localStorage.setItem('mp_user', JSON.stringify(userData));
      
      toast.success('Account created successfully! Welcome to MarketPulse.');
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed.';
      toast.error(msg);
      throw error;
    }
  };

  const logout = async (isSessionExpired = false) => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      localStorage.removeItem('mp_user');
      
      if (isSessionExpired) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.success('Successfully logged out.');
      }
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      theme,
      login,
      register,
      logout,
      toggleTheme,
      setUser
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
