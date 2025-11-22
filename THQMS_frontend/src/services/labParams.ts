export interface LabParamCfg {
  id: string;
  name: string;
  unit?: string;
  target: number;
  lcl: number;
  ucl: number;
}

const KEY = 'lab.params'

export function getDefaultLabParams(): LabParamCfg[] {
  return [
    { id: 'cu', name: '铜离子浓度', unit: 'g/L', target: 45, lcl: 40, ucl: 50 },
    { id: 'ni', name: '镍离子浓度', unit: 'g/L', target: 25, lcl: 22, ucl: 28 },
    { id: 'acid', name: '酸度', unit: 'pH', target: 3.0, lcl: 2.7, ucl: 3.3 },
    { id: 'temp', name: '温度', unit: '℃', target: 28, lcl: 26, ucl: 30 },
  ]
}

export function loadLabParams(): LabParamCfg[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as LabParamCfg[]
  } catch { /* noop */ }
  return getDefaultLabParams()
}

export function saveLabParams(params: LabParamCfg[]) {
  localStorage.setItem(KEY, JSON.stringify(params))
}
