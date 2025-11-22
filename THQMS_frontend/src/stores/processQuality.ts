import { defineStore } from 'pinia'
import { useLabStore, type LabAnomaly, type LabParam } from '@/stores/lab'

export interface PcbProcess {
  id: string;
  name: string;
  relatedParams: string[]; // lab param ids
}

export interface ProcessKpiPoint {
  ts: number;
  yieldRate: number;     // 0..1
  defectRate: number;    // 0..1
  throughput: number;    // units per time window
  lineId?: string;       // 产线
  orderId?: string;      // 工单
  sn?: string;           // PCB 编号（序列号）
}

interface ProcState {
  processes: PcbProcess[];
  kpi: Record<string, ProcessKpiPoint[]>; // processId -> points
  simTimer?: number;
  lines: string[];
  currentOrder: Record<string, string>;
  pipeline: { orderId: string; sn: string; lineId: string }[]; // 按工序顺序的流水线快照
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

export const useProcessStore = defineStore('processQuality', {
  state: (): ProcState => ({
    processes: [
      { id: 'cut', name: '开料', relatedParams: ['temp'] },
      { id: 'drill', name: '钻孔', relatedParams: ['temp'] },
      { id: 'cup', name: '沉铜', relatedParams: ['cu', 'acid', 'temp'] },
      { id: 'pattern', name: '图形转移', relatedParams: ['acid', 'temp'] },
      { id: 'etch', name: '蚀刻', relatedParams: ['acid', 'temp'] },
      { id: 'plate', name: '电镀', relatedParams: ['cu', 'ni', 'temp'] },
      { id: 'soldermask', name: '阻焊', relatedParams: ['temp'] },
      { id: 'profile', name: '成型', relatedParams: ['temp'] },
    ],
  kpi: {},
  simTimer: undefined,
  lines: ['L1', 'L2'],
  currentOrder: {},
  pipeline: [],
  }),
  getters: {
    getProc: (s) => (id: string) => s.processes.find(p => p.id === id),
    latestOf: (s) => (id: string) => {
      const arr = s.kpi[id] || [];
      return arr.length ? arr[arr.length - 1] : undefined;
    },
    latestSnAndOrder: (s) => () => {
      // 从最后一个工序的最后记录推断最近的 SN/Order
      for (let i = s.processes.length - 1; i >= 0; i--) {
        const pid = s.processes[i].id
        const arr = s.kpi[pid] || []
        if (arr.length) {
          const last = arr[arr.length - 1]
          return { sn: last.sn, orderId: last.orderId, lineId: last.lineId }
        }
      }
      return { sn: undefined as string|undefined, orderId: undefined as string|undefined, lineId: undefined as string|undefined }
    }
  },
  actions: {
    initIfNeeded() {
      this.processes.forEach(p => { if (!this.kpi[p.id]) this.kpi[p.id] = []; });
      // 初始化流水线长度与工序数一致
      if (this.pipeline.length !== this.processes.length) {
        this.pipeline = Array.from({ length: this.processes.length }, () => this.newPipelineHead())
      }
    },
    newPipelineHead() {
      const now = new Date()
      const ymd = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`
      const seq = Math.floor(Math.random()*10000).toString().padStart(4,'0')
      const sn = `PCB-${ymd}-${seq}`
      const orderId = `WO-${ymd}-${Math.floor(now.getHours()/2)}${Math.floor(Math.random()*90+10)}`
      const lineId = this.lines[Math.floor(Math.random()*this.lines.length)]
      return { orderId, sn, lineId }
    },
    simulateTick() {
      this.initIfNeeded();
      const now = Date.now();
      // 推动流水线（上游 -> 下游），新单位进入首工序
      const head = (Math.random() < 0.8) ? this.newPipelineHead() : this.pipeline[0] || this.newPipelineHead()
      this.pipeline.unshift(head)
      this.pipeline = this.pipeline.slice(0, this.processes.length)
  // 读取最近异常，影响相关工序
  const lab = useLabStore();
      const recentMs = 10 * 60 * 1000;
  const recentAnos: LabAnomaly[] = (lab?.anomalies || []).filter((a) => now - a.ts <= recentMs);
      // 上下游传导：按 processes 顺序前一工序影响后一工序
      const order = this.processes.map(p => p.id);
      this.processes.forEach((p) => {
        const arr = this.kpi[p.id];
        const last = arr.length ? arr[arr.length - 1] : undefined;
        const baseYield = last?.yieldRate ?? 0.96;
        const baseDef = last?.defectRate ?? 0.01;
        const baseTh = last?.throughput ?? 100;
        // small random walk with occasional shocks
        const jitter = () => (Math.random() - 0.5) * 0.01; // +-1%
        const shock = Math.random() < 0.05 ? (Math.random() - 0.5) * 0.05 : 0; // +-5%
  const y = clamp01(baseYield + jitter() + shock);
  let d = clamp01(baseDef + (Math.random() - 0.5) * 0.004 + (shock > 0 ? shock * 0.6 : 0));
        // coupling: higher yield => lower defects
        d = clamp01(d * (1 - (y - 0.9)));
        let th = Math.max(20, Math.round(baseTh + (Math.random() - 0.5) * 10 + (y - 0.95) * 40));

        // 1) 参数异常影响（仅关联参数）
        const related = new Set(p.relatedParams);
        let yieldDelta = 0, defectDelta = 0, thDelta = 0;
        for (const a of recentAnos) {
          if (!related.has(a.paramId)) continue;
          const sevK = a.severity === 'high' ? 0.04 : a.severity === 'medium' ? 0.02 : 0.01; // 基于严重度
          // 尝试按越界幅度加权
          let over = 1;
          const param: LabParam | undefined = lab?.getParamById?.(a.paramId);
          if (param) {
            const span = Math.max(1e-6, param.ucl - param.lcl);
            const dist = a.type === 'UCL' ? (a.value - param.ucl) : (param.lcl - a.value);
            over = Math.max(0.5, Math.min(2, dist / span * 6));
          }
          yieldDelta -= sevK * over; // 良率下降
          defectDelta += sevK * over; // 不良上升
          thDelta -= sevK * 10; // 产出略降
        }

        // 2) 上游对下游的传导
        const upIdx = order.indexOf(p.id);
        if (upIdx > 0) {
          const upId = order[upIdx - 1];
          const upLast = this.kpi[upId]?.[this.kpi[upId].length - 1];
          if (upLast) {
            const dr = (upLast.yieldRate - 0.95) * 0.2; // 偏离 95% 的 20% 传导
            yieldDelta += dr;
            defectDelta -= dr * 0.6;
            thDelta += dr * 30;
          }
        }

        const y2 = clamp01(y + yieldDelta);
        const d2 = clamp01(d + defectDelta);
        th = Math.max(10, Math.round(th + thDelta));

  // 产线/工单/SN：来自流水线对应工位
  const pipeIdx = order.indexOf(p.id)
  const snap = this.pipeline[pipeIdx] || this.newPipelineHead()
  const lineId = snap.lineId
  const orderId = snap.orderId
  const sn = snap.sn

  arr.push({ ts: now, yieldRate: y2, defectRate: d2, throughput: th, lineId, orderId, sn });
        if (arr.length > 120) arr.shift();
      });
    },
    startSimulation(intervalMs = 5000) {
      this.stopSimulation();
      this.simTimer = window.setInterval(() => this.simulateTick(), intervalMs);
      this.simulateTick();
    },
    stopSimulation() {
      if (this.simTimer) { clearInterval(this.simTimer); this.simTimer = undefined; }
    },
    clear() {
      this.kpi = {};
    }
    ,
    // 汇总：按班次/日/周聚合
    computeAggregates(bucket: 'shift'|'day'|'week', opts?: { lineId?: string; orderId?: string }) {
      const res: { processId: string; key: string; startTs: number; endTs: number; yieldAvg: number; defectAvg: number; throughputSum: number }[] = []
      const bucketKey = (ts: number) => {
        const d = new Date(ts)
        if (bucket === 'day') return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
        if (bucket === 'week') {
          const oneJan = new Date(d.getFullYear(),0,1)
          const ms = d.getTime() - oneJan.getTime()
          const week = Math.ceil((ms / 86400000 + oneJan.getDay()+1) / 7)
          return `${d.getFullYear()}-W${week}`
        }
        // shift: 0:00-8:00 / 8:00-16:00 / 16:00-24:00
        const h = d.getHours(); const s = h<8?0:h<16?1:2
        return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}-S${s}`
      }
      this.processes.forEach(p => {
        const arr = (this.kpi[p.id]||[]).filter(pt => (!opts?.lineId || pt.lineId===opts.lineId) && (!opts?.orderId || pt.orderId===opts.orderId))
        const byKey: Record<string, { ys: number[]; ds: number[]; th: number; minTs: number; maxTs: number }> = {}
        arr.forEach(pt => {
          const k = bucketKey(pt.ts)
          if (!byKey[k]) byKey[k] = { ys: [], ds: [], th: 0, minTs: pt.ts, maxTs: pt.ts }
          byKey[k].ys.push(pt.yieldRate)
          byKey[k].ds.push(pt.defectRate)
          byKey[k].th += pt.throughput
          byKey[k].minTs = Math.min(byKey[k].minTs, pt.ts)
          byKey[k].maxTs = Math.max(byKey[k].maxTs, pt.ts)
        })
        Object.entries(byKey).forEach(([k, g]) => {
          res.push({ processId: p.id, key: k, startTs: g.minTs, endTs: g.maxTs, yieldAvg: avg(g.ys), defectAvg: avg(g.ds), throughputSum: g.th })
        })
      })
      return res
    }
  }
});

function avg(arr: number[]) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 }
