import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        react(),
        tailwindcss()
    ],
    server: {
        host: '127.0.0.1',
        port: 5173,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
                history: resolve(__dirname, 'history.html'),
                inventoryLogs: resolve(__dirname, 'inventory-logs.html'),
                indexLegacy: resolve(__dirname, 'index_legacy.html')
            }
        }
    }
});
