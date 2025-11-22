import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import type { ConfigEnv, UserConfig, UserConfigExport } from 'vite'
import viteConfig from './vite.config'

// 适配 vite.config 可能导出函数或对象两种形式，避免将函数直接传给 mergeConfig 造成类型不匹配
// 将 vite 配置统一解析为对象（支持函数/对象两种导出）
const resolveViteConfig = async (cfg: UserConfigExport, env: ConfigEnv): Promise<UserConfig> =>
  typeof cfg === 'function' ? await cfg(env) : await Promise.resolve(cfg)

export default defineConfig(async (env) => {
  const base = await resolveViteConfig(viteConfig as UserConfigExport, env as unknown as ConfigEnv)
  return mergeConfig(base, {
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  })
})
