import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-island-audio-assets',
      closeBundle() {
        const srcAudio = path.resolve('assets/audio');
        const destAudio = path.resolve('dist/assets/audio');
        if (fs.existsSync(srcAudio)) {
          fs.mkdirSync(path.dirname(destAudio), { recursive: true });
          fs.cpSync(srcAudio, destAudio, { recursive: true });
        }
      },
    },
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
  },
});
