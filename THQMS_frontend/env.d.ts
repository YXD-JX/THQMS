/// <reference types="vite/client" />

interface ImportMetaEnv {
	// 留空以允许项目不强制声明特定环境变量；保留索引签名避免空接口告警
	readonly [key: string]: string | undefined
}
interface ImportMeta {
	readonly env: ImportMetaEnv
}
