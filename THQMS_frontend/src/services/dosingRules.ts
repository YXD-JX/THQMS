import type { LabAnomaly, LabParam } from '@/stores/lab'

export interface DosingRuleResult {
  chemical: string;
  amount: number;
  unit: string;
  reason: string;
}

export interface RuleEntry {
  chemLow: string;      // 低于下限/目标时补加的药品
  chemHigh: string;     // 高于上限/目标时补加的药品（通常为稀释/纯水/降温）
  coef: number;         // 量化系数：|Δ| * coef
  unit: string;         // 单位
  min: number;          // 下限
  max: number;          // 上限
  round: number;        // 步进取整
}

export type RulesMap = Record<string, RuleEntry>

const KEY = 'dosing.rules'

export function getDefaultRules(): RulesMap {
  return {
    cu:   { chemLow: '硫酸铜',   chemHigh: '纯水',   coef: 0.8, unit: 'L',     min: 0.2, max: 20,  round: 0.1 },
    ni:   { chemLow: '硫酸镍',   chemHigh: '纯水',   coef: 0.7, unit: 'L',     min: 0.2, max: 20,  round: 0.1 },
    acid: { chemLow: '硫酸',     chemHigh: '纯水',   coef: 0.5, unit: 'L',     min: 0.1, max: 10,  round: 0.1 },
    temp: { chemLow: '加热',     chemHigh: '冷却水', coef: 1.0, unit: 'kWh/L', min: 0,   max: 999, round: 0.5 },
  }
}

export function loadRules(): RulesMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as RulesMap
  } catch { /* noop */ }
  return getDefaultRules()
}

export function saveRules(rules: RulesMap) {
  localStorage.setItem(KEY, JSON.stringify(rules))
}

// 简单规则引擎（前期模拟，可配置）
// 根据参数与偏差，生成推荐药品与补加量
export function computeDosing(anomaly: LabAnomaly, param: LabParam): DosingRuleResult {
  const delta = anomaly.type === 'LCL' ? (param.target - anomaly.value) : (anomaly.value - param.target)
  const map = loadRules()
  const fallback: RuleEntry = { chemLow: '药剂A', chemHigh: '纯水', coef: 0.6, unit: 'L', min: 0.1, max: 10, round: 0.1 }
  const cfg = map[param.id] || fallback
  const chem = anomaly.type === 'LCL' ? cfg.chemLow : cfg.chemHigh
  let amt = Math.abs(delta) * cfg.coef
  // 限制、取整
  amt = Math.max(cfg.min, Math.min(cfg.max, amt))
  amt = Math.round(amt / cfg.round) * cfg.round
  const reason = `${param.name}${anomaly.type === 'LCL' ? '低于' : '高于'}目标Δ=${delta.toFixed(2)}，按系数${cfg.coef} 推荐“${chem}” ${amt}${cfg.unit}`
  return { chemical: chem, amount: Number(amt.toFixed(3)), unit: cfg.unit, reason }
}
