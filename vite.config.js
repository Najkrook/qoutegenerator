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
                main: resolve(__dirname, 'index.html')
            },
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;

                    if (
                        id.includes('jspdf')
                        || id.includes('jspdf-autotable')
                        || id.includes('xlsx')
                        || id.includes('html2canvas')
                    ) {
                        return 'export-tools';
                    }

                    if (id.includes('firebase')) {
                        return 'firebase';
                    }

                    if (
                        id.includes('react')
                        || id.includes('scheduler')
                        || id.includes('react-hot-toast')
                    ) {
                        return 'react-vendor';
                    }

                    return undefined;
                }
            }
        }
    }
});
