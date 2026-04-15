import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { QuoteProvider } from './store/QuoteContext';
import { AuthProvider } from './store/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <QuoteProvider>
                <App />
                <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
            </QuoteProvider>
        </AuthProvider>
    </StrictMode>,
);
