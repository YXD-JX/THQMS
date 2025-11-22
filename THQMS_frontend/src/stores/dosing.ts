import { defineStore } from 'pinia'
import type { LabAnomaly, LabParam } from './lab'

export type DosingStatus = 'pending' | 'approved-qc' | 'approved-prod' | 'completed' | 'rejected'

export interface DosingOrder {
  id: string
  ts: number
  paramId: string
  paramName: string
  severity: 'low' | 'medium' | 'high'
  anomalyId: string
  type: 'LCL' | 'UCL'
  value: number
  target: number
  recommendation: { chemical: string; amount: number; unit: string; reason: string }
  requestedBy: string
  approverQc?: string
  approverProd?: string
  status: DosingStatus
}

export interface LastBatchItemSnapshot {
  id: string;
  prevStatus: DosingStatus;
  prevApproverQc?: string;
  prevApproverProd?: string;
}
export interface LastBatch {
  action: 'approve-qc' | 'approve-prod' | 'reject';
  items: LastBatchItemSnapshot[];
  ts: number;
}

export const useDosingStore = defineStore('dosing', {
  state: () => ({
    orders: [] as DosingOrder[],
    _bootstrapped: false,
    lastBatch: null as LastBatch | null,
  }),
  getters: {
    pending: (s) => s.orders.filter(o => o.status === 'pending' || o.status === 'approved-qc' || o.status === 'approved-prod'),
  },
  actions: {
    initIfNeeded() {
      if (this._bootstrapped) return
      this._bootstrapped = true
      // 加载持久化
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as DosingOrder[]
          if (Array.isArray(parsed)) this.orders = parsed
        }
        const rawBatch = localStorage.getItem(STORAGE_LASTBATCH_KEY)
        if (rawBatch) {
          const parsedB = JSON.parse(rawBatch) as LastBatch
          if (parsedB && parsedB.items && Array.isArray(parsedB.items)) this.lastBatch = parsedB
        }
      } catch { /* ignore */ }
      // 跨标签同步
      const onStorage = (e: StorageEvent) => {
        try {
          if (e.key === STORAGE_KEY) {
            const parsed = e.newValue ? JSON.parse(e.newValue) as DosingOrder[] : []
            if (Array.isArray(parsed)) this.orders = parsed
          } else if (e.key === STORAGE_LASTBATCH_KEY) {
            const parsedB = e.newValue ? JSON.parse(e.newValue) as LastBatch : null
            this.lastBatch = parsedB
          }
        } catch { /* ignore */ }
      }
      window.addEventListener('storage', onStorage)
    },
    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orders)) } catch { /* ignore */ }
    },
    saveLastBatch() {
      try {
        if (this.lastBatch) localStorage.setItem(STORAGE_LASTBATCH_KEY, JSON.stringify(this.lastBatch))
        else localStorage.removeItem(STORAGE_LASTBATCH_KEY)
      } catch { /* ignore */ }
    },
    setLastBatch(b: LastBatch | null) { this.lastBatch = b; this.saveLastBatch() },
    undoLastBatch() {
      const b = this.lastBatch; if (!b) return;
      b.items.forEach((snap: LastBatchItemSnapshot) => {
        const { id, prevStatus, prevApproverQc, prevApproverProd } = snap;
        const o = this.orders.find(x => x.id === id); if (!o) return;
        o.status = prevStatus;
        o.approverQc = prevApproverQc;
        o.approverProd = prevApproverProd;
      });
      this.save();
      this.lastBatch = null;
      this.saveLastBatch();
    },
    createFrom(anomaly: LabAnomaly, param: LabParam, recommendation: DosingOrder['recommendation']) {
      const id = `DOSE-${anomaly.id}`
      // 幂等：已存在则直接返回
      const existed = this.orders.find(o => o.id === id)
      if (existed) return existed
      const order: DosingOrder = {
        id,
        ts: Date.now(),
        paramId: anomaly.paramId,
        paramName: param.name,
        severity: anomaly.severity,
        anomalyId: anomaly.id,
        type: anomaly.type,
        value: anomaly.value,
        target: param.target,
        recommendation,
        requestedBy: 'system',
        status: 'pending',
      }
      this.orders.unshift(order)
      this.save()
      return order
    },
    approveQc(id: string, user: string) {
      const o = this.orders.find(x => x.id === id); if (!o) return
      o.approverQc = user
      o.status = o.status === 'approved-prod' ? 'completed' : 'approved-qc'
      this.save()
    },
    approveProd(id: string, user: string) {
      const o = this.orders.find(x => x.id === id); if (!o) return
      o.approverProd = user
      o.status = o.status === 'approved-qc' ? 'completed' : 'approved-prod'
      this.save()
    },
    reject(id: string) {
      const o = this.orders.find(x => x.id === id); if (!o) return
      o.status = 'rejected'
      this.save()
    },
    clear() { this.orders = []; this.save() }
  }
})

const STORAGE_KEY = 'thqms.dosing.orders.v1'
const STORAGE_LASTBATCH_KEY = 'thqms.dosing.lastbatch.v1'
