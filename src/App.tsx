import React, { useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppRoutes } from './routes/AppRoutes';
import { useAnimatedFavicon } from './hooks/useAnimatedFavicon';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

function CapacitorHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(err => console.log('StatusBar style error:', err));
      StatusBar.setBackgroundColor({ color: '#f8fafc' }).catch(err => console.log('StatusBar background error:', err));

      const backButtonListener = CapApp.addListener('backButton', () => {
        if (location.pathname !== '/' && location.pathname !== '/dashboard') {
          navigate('/dashboard');
        } else {
          CapApp.exitApp();
        }
      });

      return () => {
        backButtonListener.then(listener => listener.remove());
      };
    }
  }, [location.pathname, navigate]);

  return null;
}

export function App() {
  useAnimatedFavicon();

  return (
    <BrowserRouter>
      <AppProvider>
        <CapacitorHandler />
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
