import { defineStore } from 'pinia'

export interface CustomerStandard {
  processId: string
  paramId: string
  target?: number
  lcl: number
  ucl: number
}

interface StandardsState {
  // processId -> paramId -> standard
  map: Record<string, Record<string, CustomerStandard>>
}

const KEY = 'qms-standards-v1'

export const useStandardsStore = defineStore('standards', {
  state: (): StandardsState => ({ map: {} }),
  getters: {
    get: (s) => (processId: string, paramId: string): CustomerStandard | undefined => s.map[processId]?.[paramId],
    listByProcess: (s) => (processId: string) => Object.values(s.map[processId] || {}),
  },
  actions: {
    load() {
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) this.map = JSON.parse(raw)
      } catch { /* ignore */ }
    },
    save() {
      localStorage.setItem(KEY, JSON.stringify(this.map))
    },
    setStandard(std: CustomerStandard) {
      if (!this.map[std.processId]) this.map[std.processId] = {}
      this.map[std.processId][std.paramId] = { ...std }
      this.save()
    },
    removeStandard(processId: string, paramId: string) {
      if (this.map[processId]) {
        delete this.map[processId][paramId]
        if (!Object.keys(this.map[processId]).length) delete this.map[processId]
        this.save()
      }
    },
    isWithin(processId: string, paramId: string, value: number): boolean | undefined {
      const s = this.map[processId]?.[paramId]
      if (!s) return undefined
      return value >= s.lcl && value <= s.ucl
    },
    exportJson(): string {
      return JSON.stringify({ version: 1, map: this.map }, null, 2)
    },
    importJson(text: string) {
      const obj = JSON.parse(text)
      if (obj && obj.map && typeof obj.map === 'object') {
        this.map = obj.map
        this.save()
      } else {
        throw new Error('无效的标准JSON')
      }
    }
  }
})
