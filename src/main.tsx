import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { appRouter } from './App';
import { QuoteProvider } from './store/QuoteContext';
import { AuthProvider } from './store/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <QuoteProvider>
                <RouterProvider router={appRouter} />
                <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
            </QuoteProvider>
        </AuthProvider>
    </StrictMode>,
);
