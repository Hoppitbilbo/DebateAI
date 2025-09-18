import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiKeyContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  isApiKeySet: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

const API_KEY_STORAGE_KEY = 'gemini_api_key';

interface ApiKeyProviderProps {
  children: ReactNode;
}

export const ApiKeyProvider: React.FC<ApiKeyProviderProps> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  // Load API key from session storage on mount
  useEffect(() => {
    const storedApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedApiKey) {
      setApiKeyState(storedApiKey);
    }
  }, []);

  const setApiKey = (key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      sessionStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
      setApiKeyState(trimmedKey);
    }
  };

  const clearApiKey = () => {
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKeyState(null);
  };

  const isApiKeySet = Boolean(apiKey && apiKey.length > 0);

  const value: ApiKeyContextType = {
    apiKey,
    setApiKey,
    clearApiKey,
    isApiKeySet,
  };

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = (): ApiKeyContextType => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};