// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwind(), // ★ Tailwind v4 の Vite プラグイン
  ],
  base: '/PhyloWeaver/',
  server: {
    host: '0.0.0.0',        // LAN 公開（同一ネットワークのPC/スマホからアクセス可）
    port: 5173,
    strictPort: true,       // 5173 が埋まってたら起動失敗にして気づけるように
    hmr: {
      host: '192.168.50.34', // ★ サーバー側のLAN IP（今の環境に合わせて）
      protocol: 'ws',
      port: 5173,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  // base はデフォルト '/' のままでOK。ローカル開発で真っ白になるのを避ける
})

