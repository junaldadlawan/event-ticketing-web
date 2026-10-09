import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ViewModeProvider } from './auth/ViewMode';
import { CartProvider } from './cart/CartContext';
import { UnsavedChangesProvider } from './components/UnsavedChanges';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UnsavedChangesProvider>
        <AuthProvider>
          <CartProvider>
            <ViewModeProvider>
              <App />
            </ViewModeProvider>
          </CartProvider>
        </AuthProvider>
      </UnsavedChangesProvider>
    </BrowserRouter>
  </StrictMode>,
);
