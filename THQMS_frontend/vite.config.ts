import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

function httpsConfig(env: Record<string, string>) {
  // 优先使用 PFX（.p12）
  if (env.VITE_DEV_PFX) {
    const pfxPath = path.resolve(process.cwd(), env.VITE_DEV_PFX)
    if (fs.existsSync(pfxPath)) {
      return { pfx: fs.readFileSync(pfxPath), passphrase: env.VITE_DEV_PFX_PASSPHRASE || undefined }
    }
  }
  // 其次使用 cert/key
  const certPath = env.VITE_DEV_CERT ? path.resolve(process.cwd(), env.VITE_DEV_CERT) : path.resolve(process.cwd(), 'cert', 'dev-cert.pem')
  const keyPath = env.VITE_DEV_KEY ? path.resolve(process.cwd(), env.VITE_DEV_KEY) : path.resolve(process.cwd(), 'cert', 'dev-key.pem')
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
  }
  // 仅开启 https（无证书文件，使用空配置）
  return {}
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useHttps = env.VITE_DEV_HTTPS === '1' || env.HTTPS === 'true'
  return {
    plugins: [
      vue(),
      vueJsx(),
      vueDevTools(),
    ],
    server: {
      host: true, // 0.0.0.0 监听，便于局域网访问
      port: 5173,
      https: useHttps ? httpsConfig(env) : undefined,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
