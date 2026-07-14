import React, { createContext, useContext, useEffect, useState } from 'react';
import { IServiceProvider } from '@ynotv/core';
import { SqliteServiceProvider } from '../db/repositories/SqliteServiceProvider';

const ServiceProviderContext = createContext<IServiceProvider | null>(null);

export const ServiceProviderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider] = useState(() => new SqliteServiceProvider());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    provider.initialize().then(() => {
      if (active) {
        setInitialized(true);
      }
    });
    return () => {
      active = false;
      provider.dispose();
    };
  }, [provider]);

  if (!initialized) {
    return null; // Or a splash/loading screen if needed
  }

  return (
    <ServiceProviderContext.Provider value={provider}>
      {children}
    </ServiceProviderContext.Provider>
  );
};

export const useServiceProvider = (): IServiceProvider => {
  const context = useContext(ServiceProviderContext);
  if (!context) {
    throw new Error('useServiceProvider must be used within a ServiceProviderProvider');
  }
  return context;
};
