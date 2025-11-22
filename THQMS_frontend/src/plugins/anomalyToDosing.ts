import type { LabAnomaly } from '@/stores/lab'
import { useLabStore } from '@/stores/lab'
import { useDosingStore } from '@/stores/dosing'
import { computeDosing } from '@/services/dosingRules'

// 监听异常事件，自动生成补加药水单据
export function installAnomalyToDosing() {
  const lab = useLabStore()
  const dosing = useDosingStore()
  const onAnomaly = (ev: Event) => {
    const a = (ev as CustomEvent<LabAnomaly>).detail
    if (!a) return
    const p = lab.getParamById(a.paramId)
    if (!p) return
    const rec = computeDosing(a, p)
    dosing.createFrom(a, p, rec)
  }
  window.addEventListener('lab-anomaly', onAnomaly as EventListener)
  return () => window.removeEventListener('lab-anomaly', onAnomaly as EventListener)
}
