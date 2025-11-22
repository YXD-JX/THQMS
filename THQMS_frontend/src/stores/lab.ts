import { defineStore } from 'pinia';

export interface LabParam {
  id: string;
  name: string;
  unit?: string;
  target: number;
  lcl: number;
  ucl: number;
}

export interface LabMeasurement {
  ts: number; // timestamp
  paramId: string;
  value: number;
}

export interface LabAnomaly {
  id: string;
  ts: number;
  paramId: string;
  value: number;
  type: 'LCL' | 'UCL';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export const useLabStore = defineStore('lab', {
  state: () => ({
    params: [
      { id: 'cu', name: '铜离子浓度', unit: 'g/L', target: 45, lcl: 40, ucl: 50 },
      { id: 'ni', name: '镍离子浓度', unit: 'g/L', target: 25, lcl: 22, ucl: 28 },
      { id: 'acid', name: '酸度', unit: 'pH', target: 3.0, lcl: 2.7, ucl: 3.3 },
      { id: 'temp', name: '温度', unit: '℃', target: 28, lcl: 26, ucl: 30 },
    ] as LabParam[],
    series: {} as Record<string, number[]>, // paramId -> values
    times: [] as string[], // formatted times corresponding to index
    meas: {} as Record<string, { ts: number; value: number }[]>, // 带时间戳的测量
    anomalies: [] as LabAnomaly[],
    simTimer: undefined as number | undefined,
  }),
  getters: {
    getParamById: (state) => (id: string) => state.params.find(p => p.id === id),
  },
  actions: {
    initIfNeeded() {
      // initialize series arrays
      this.params.forEach(p => {
        if (!this.series[p.id]) this.series[p.id] = [];
        if (!this.meas[p.id]) this.meas[p.id] = [];
      });
    },
    addMeasurement(m: LabMeasurement) {
      this.initIfNeeded();
      const arr = this.series[m.paramId];
      arr.push(m.value);
      // 保存带时间戳的测量
      this.meas[m.paramId].push({ ts: m.ts, value: m.value });
      if (this.meas[m.paramId].length > 1000) this.meas[m.paramId].shift();
      const date = new Date(m.ts);
      const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      this.times.push(label);
      this.evaluateAnomaly(m);
    },
    // 查找与给定时间最近的测量（在窗口内）
    nearestMeasurement(paramId: string, ts: number, windowMs = 10 * 60 * 1000): { ts: number; value: number } | undefined {
      const arr = this.meas[paramId] || [];
      if (!arr.length) return undefined;
      let best: { ts: number; value: number } | undefined;
      let bestDiff = Number.POSITIVE_INFINITY;
      for (const it of arr) {
        const d = Math.abs(it.ts - ts);
        if (d < bestDiff) { best = it; bestDiff = d; }
      }
      if (best && bestDiff <= windowMs) return best;
      return undefined;
    },
    evaluateAnomaly(m: LabMeasurement) {
      const p = this.getParamById(m.paramId);
      if (!p) return;
      let type: 'LCL' | 'UCL' | null = null;
      if (m.value < p.lcl) type = 'LCL';
      else if (m.value > p.ucl) type = 'UCL';
      if (type) {
        const anomaly: LabAnomaly = {
          id: `${m.paramId}-${m.ts}`,
          ts: m.ts,
          paramId: m.paramId,
          value: m.value,
          type,
          message: `${p.name} ${type === 'LCL' ? '低于下限' : '高于上限'}：${m.value}${p.unit || ''}`,
          severity: type === 'UCL' ? 'high' : 'medium',
        };
        this.anomalies.unshift(anomaly);
        // emit DOM event for local alarm consumers
        window.dispatchEvent(new CustomEvent('lab-anomaly', { detail: anomaly }));
        // try async email push (simulation, obey notifications.emailEnabled)
        // 延迟加载避免主包增大
        import('../stores/notifications').then(({ useNotiStore }) => {
          const ns = useNotiStore();
          if (ns.emailEnabled) {
            import('../services/emailService').then(({ sendAnomalyEmail }) => {
              sendAnomalyEmail(anomaly, p).catch(() => {});
            });
          }
        });
      }
    },
    simulateTick() {
      const now = Date.now();
      this.params.forEach((p) => {
        // gaussian-ish noise
        const noise = (Math.random() + Math.random() + Math.random()) / 3 - 0.5; // ~[-0.5,0.5]
        const range = (p.ucl - p.lcl) / 6; // 3-sigma
        let v = p.target + noise * range * 2;
        // occasional outlier
        if (Math.random() < 0.1) {
          v = Math.random() < 0.5 ? p.lcl - range * (1 + Math.random()) : p.ucl + range * (1 + Math.random());
        }
        this.addMeasurement({ ts: now, paramId: p.id, value: parseFloat(v.toFixed(2)) });
      });
    },
    startSimulation(intervalMs = 3000) {
      this.stopSimulation();
      this.simTimer = window.setInterval(() => this.simulateTick(), intervalMs);
      // add a first tick immediately for faster feedback
      this.simulateTick();
    },
    stopSimulation() {
      if (this.simTimer) {
        clearInterval(this.simTimer);
        this.simTimer = undefined;
      }
    },
    clear() {
      this.series = {};
      this.times = [];
      this.anomalies = [];
    }
  }
});
