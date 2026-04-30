'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Download, Grid, BarChart2, AlertTriangle, Check, Clock, Save } from 'lucide-react'
import { getBrands, getPlanningWeek, savePlanningSlot, getPlanningWeekKeys } from '@/lib/supabase'
import { Button, Card, CardHeader, CardTitle, Spinner, cn } from '@/components/ui'

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const SHOP_OPEN = 10, SHOP_CLOSE = 20
const HOURS = Array.from({length: SHOP_CLOSE - SHOP_OPEN}, (_, i) => i + SHOP_OPEN)

const SLOTS = [
  { id:'morning',   label:'10h – 15h', start:10, end:15, color:'#3B82F6', bg:'#EFF6FF' },
  { id:'afternoon', label:'15h – 20h', start:15, end:20, color:'#10B981', bg:'#ECFDF5' },
  { id:'full',      label:'10h – 20h', start:10, end:20, color:'#6366F1', bg:'#EEF2FF' },
  { id:'custom',    label:'Horaire personnalisé', start:0, end:0, color:'#F59E0B', bg:'#FFFBEB' },
  { id:'off',       label:'Absent',   start:0,  end:0,  color:'#9CA3AF', bg:'#F9FAFB' },
]
type SlotId = 'morning'|'afternoon'|'full'|'custom'|'off'
type CreatorSlot = { slotId: SlotId; customStart?: number; customEnd?: number }
type PlanningData = Record<string, Record<number, Record<string, CreatorSlot>>>
type Creator = { id: string; name: string }

// ─── Helpers ──────────────────────────────────────────────────
function getWeekKey(d: Date) {
  const x = new Date(d), day = x.getDay()
  x.setDate(x.getDate() - day + (day === 0 ? -6 : 1))
  return x.toISOString().split('T')[0]
}
function getMon(k: string) { return new Date(k + 'T00:00:00') }
function addWeeks(k: string, n: number) {
  const d = getMon(k); d.setDate(d.getDate() + n * 7); return getWeekKey(d)
}
function fmtWeek(k: string) {
  const m = getMon(k), s = new Date(m); s.setDate(m.getDate() + 5)
  return `${m.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} – ${s.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}`
}
function fmtWeekShort(k: string) {
  const m = getMon(k)
  return m.toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
}
function getCov(slot: CreatorSlot): {start:number;end:number} | null {
  if (slot.slotId === 'off') return null
  if (slot.slotId === 'custom') {
    return slot.customStart != null && slot.customEnd != null && slot.customEnd > slot.customStart
      ? { start: slot.customStart, end: slot.customEnd } : null
  }
  const def = SLOTS.find(t => t.id === slot.slotId)!
  return { start: def.start, end: def.end }
}
function getGaps(daySlots: Record<string, CreatorSlot>) {
  const covered = new Set<number>()
  Object.values(daySlots).forEach(slot => { const c = getCov(slot); if (c) for (let h = c.start; h < c.end; h++) covered.add(h) })
  const gaps: {start:number;end:number}[] = []; let gs: number | null = null
  for (let h = SHOP_OPEN; h < SHOP_CLOSE; h++) {
    if (!covered.has(h)) { if (gs === null) gs = h }
    else { if (gs !== null) { gaps.push({start:gs,end:h}); gs = null } }
  }
  if (gs !== null) gaps.push({ start: gs, end: SHOP_CLOSE })
  return gaps
}

// ─── SlotPicker ───────────────────────────────────────────────
function SlotPicker({ value, onChange, saving }: {
  value: CreatorSlot | undefined
  onChange: (s: CreatorSlot) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [cStart, setCStart] = useState(10)
  const [cEnd, setCEnd] = useState(15)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setShowCustom(false) } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const cur = value ?? { slotId: 'off' as SlotId }
  const def = SLOTS.find(t => t.id === cur.slotId) ?? SLOTS[4]
  const label = cur.slotId === 'custom' && cur.customStart != null
    ? `${cur.customStart}h – ${cur.customEnd}h`
    : def.label

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setShowCustom(false) }}
        disabled={saving}
        className="w-full flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
        style={{
          background: cur.slotId === 'off' ? '#F9FAFB' : `${def.color}18`,
          color: cur.slotId === 'off' ? '#9CA3AF' : def.color,
          border: `1px solid ${cur.slotId === 'off' ? '#E5E7EB' : `${def.color}40`}`,
        }}>
        <span className="truncate">{label}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
          {SLOTS.filter(t => t.id !== 'custom').map(t => (
            <button key={t.id}
              onClick={() => { onChange({ slotId: t.id as SlotId }); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }}/>
              <span style={{ color: t.id === cur.slotId ? t.color : '#374151' }}>{t.label}</span>
              {t.id === cur.slotId && <Check size={11} className="ml-auto" style={{ color: t.color }}/>}
            </button>
          ))}
          {/* Custom slot */}
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)}
              className="w-full text-left px-3 py-2.5 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#F59E0B' }}/>
              <span style={{ color: cur.slotId === 'custom' ? '#F59E0B' : '#374151' }}>
                {cur.slotId === 'custom' ? label : 'Horaire personnalisé…'}
              </span>
              {cur.slotId === 'custom' && <Check size={11} className="ml-auto" style={{ color: '#F59E0B' }}/>}
            </button>
          ) : (
            <div className="border-t border-gray-100 p-3 space-y-2.5">
              <p className="text-xs font-bold text-gray-700">Horaire personnalisé</p>
              <div className="flex items-center gap-2">
                <select value={cStart} onChange={e => setCStart(Number(e.target.value))}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                  {Array.from({length: 10}, (_, i) => i + 10).map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
                <span className="text-xs text-gray-400 shrink-0">→</span>
                <select value={cEnd} onChange={e => setCEnd(Number(e.target.value))}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                  {Array.from({length: 10}, (_, i) => i + 11).map(h => (
                    <option key={h} value={h} disabled={h <= cStart}>{h}h</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (cEnd > cStart) {
                    onChange({ slotId: 'custom', customStart: cStart, customEnd: cEnd })
                    setOpen(false); setShowCustom(false)
                  }
                }}
                className="w-full py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors">
                Valider
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function PlanningPage() {
  const [creators, setCreators]       = useState<Creator[]>([])
  const [weekKey, setWeekKey]         = useState(getWeekKey(new Date()))
  const [planning, setPlanning]       = useState<PlanningData>({})
  const [loading, setLoading]         = useState(true)
  const [weekLoading, setWeekLoading] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [savedAt, setSavedAt]         = useState<Date | null>(null)
  const [view, setView]               = useState<'grid'|'coverage'>('grid')
  const [weekKeys, setWeekKeys]       = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Load creators once
  useEffect(() => {
    getBrands()
      .then(d => setCreators((d || []) as Creator[]))
      .catch(() => {})
    // Seed from localStorage for offline fallback
    try {
      const s = localStorage.getItem('ateli_planning')
      if (s) setPlanning(JSON.parse(s))
    } catch {}
  }, [])

  // Load week from Supabase
  const loadWeek = useCallback(async (wk: string) => {
    setWeekLoading(true)
    try {
      const rows = await getPlanningWeek(wk)
      setPlanning(prev => {
        const next: PlanningData = { ...prev, [wk]: {} }
        for (const row of (rows as any[])) {
          if (!next[wk][row.day_index]) next[wk][row.day_index] = {}
          next[wk][row.day_index][row.creator_id] = {
            slotId: row.slot_id as SlotId,
            customStart: row.custom_start ?? undefined,
            customEnd: row.custom_end ?? undefined,
          }
        }
        return next
      })
    } catch {} finally { setWeekLoading(false) }
  }, [])

  // Load week history keys
  const loadHistory = useCallback(async () => {
    try {
      const keys = await getPlanningWeekKeys()
      setWeekKeys(keys as string[])
    } catch {}
  }, [])

  useEffect(() => {
    getBrands()
      .then(d => { setCreators((d || []) as Creator[]); setLoading(false) })
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    loadWeek(weekKey)
  }, [weekKey, loadWeek])

  const getSlot = (di: number, cId: string) => planning[weekKey]?.[di]?.[cId]

  const setSlot = useCallback(async (di: number, cId: string, slot: CreatorSlot) => {
    // Optimistic update
    setPlanning(prev => {
      const next = structuredClone(prev)
      if (!next[weekKey]) next[weekKey] = {}
      if (!next[weekKey][di]) next[weekKey][di] = {}
      next[weekKey][di][cId] = slot
      // Persist to localStorage as fallback
      try { localStorage.setItem('ateli_planning', JSON.stringify(next)) } catch {}
      return next
    })
    // Save to Supabase
    setSaving(true)
    try {
      await savePlanningSlot({
        week_key:     weekKey,
        day_index:    di,
        creator_id:   cId,
        slot_id:      slot.slotId,
        custom_start: slot.customStart ?? null,
        custom_end:   slot.customEnd ?? null,
      })
      setSavedAt(new Date())
      // Refresh history keys
      loadHistory()
    } catch (e) { console.error('[planning save]', e) }
    finally { setSaving(false) }
  }, [weekKey, loadHistory])

  const dayAnalysis = useMemo(() => DAYS.map((_, di) => {
    const ds = planning[weekKey]?.[di] ?? {}
    const gaps = getGaps(ds)
    return { daySlots: ds, gaps, covered: gaps.length === 0 }
  }), [planning, weekKey])

  const coveredCount  = dayAnalysis.filter(d => d.covered).length
  const totalGapHours = dayAnalysis.reduce((s, d) => s + d.gaps.reduce((g, gap) => g + (gap.end - gap.start), 0), 0)

  const exportTxt = () => {
    let txt = `Planning Ateli — ${fmtWeek(weekKey)}\n${'='.repeat(50)}\n\n`
    DAYS.forEach((day, i) => {
      txt += `${day}\n`
      const ds = planning[weekKey]?.[i] ?? {}
      creators.forEach(c => {
        const s = ds[c.id]; const cov = s ? getCov(s) : null
        txt += `  ${c.name}: ${cov ? `${cov.start}h–${cov.end}h` : 'Absent'}\n`
      })
      const gaps = getGaps(ds)
      if (gaps.length > 0) txt += `  ⚠ Vide: ${gaps.map(g => `${g.start}h-${g.end}h`).join(', ')}\n`
      txt += '\n'
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }))
    a.download = `planning-${weekKey}.txt`; a.click()
  }

  const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
  const isToday = (di: number) => {
    const m = getMon(weekKey), d = new Date(m); d.setDate(m.getDate() + di)
    return d.toDateString() === new Date().toDateString()
  }
  const dayDate = (di: number) => {
    const m = getMon(weekKey), d = new Date(m); d.setDate(m.getDate() + di)
    return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
  }
  const TOTAL = SHOP_CLOSE - SHOP_OPEN

  if (loading) return <div className="flex-1 flex items-center justify-center bg-gray-50"><Spinner size="lg"/></div>

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-full px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning boutique</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-500 text-sm">10h – 20h · Lundi au Samedi</p>
              {saving && <span className="text-xs text-indigo-600 flex items-center gap-1"><Save size={11} className="animate-pulse"/> Enregistrement…</span>}
              {!saving && savedAt && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={11}/> Enregistré à {savedAt.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
              <button onClick={() => setView('grid')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all', view==='grid'?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50')}>
                <Grid size={14}/> Grille
              </button>
              <button onClick={() => setView('coverage')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all', view==='coverage'?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50')}>
                <BarChart2 size={14}/> Couverture
              </button>
            </div>

            {/* Week nav */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setWeekKey(addWeeks(weekKey,-1))}><ChevronLeft size={16}/></Button>
              <div className="text-center min-w-[160px]">
                <p className="text-sm font-bold text-gray-900">{fmtWeek(weekKey)}</p>
                {weekKey === getWeekKey(new Date()) && <p className="text-xs text-blue-500 font-medium">Semaine actuelle</p>}
              </div>
              <Button variant="outline" size="icon" onClick={() => setWeekKey(addWeeks(weekKey,1))}><ChevronRight size={16}/></Button>
            </div>

            <Button variant="outline" size="sm" onClick={() => setWeekKey(getWeekKey(new Date()))}>Aujourd'hui</Button>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className={cn('gap-1.5', showHistory && 'bg-gray-100')}>
              <Clock size={14}/> Historique
              {weekKeys.length > 0 && <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full font-bold">{weekKeys.length}</span>}
            </Button>
            <Button variant="outline" size="sm" onClick={exportTxt}><Download size={14}/></Button>
          </div>
        </div>

        {/* History panel */}
        {showHistory && weekKeys.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Semaines enregistrées</p>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {weekKeys.map(wk => (
                <button key={wk} onClick={() => { setWeekKey(wk); setShowHistory(false) }}
                  className={cn('px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
                    wk === weekKey
                      ? 'bg-gray-900 text-white border-gray-900'
                      : wk === getWeekKey(new Date())
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                  {fmtWeekShort(wk)}
                  {wk === getWeekKey(new Date()) && <span className="ml-1 text-xs font-normal">· actuelle</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {weekLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
            <Spinner size="sm"/> Chargement du planning…
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label:'Jours couverts', value:`${coveredCount}/6`, ok: coveredCount===6 },
            { label:'Heures manquantes', value:`${totalGapHours}h`, ok: totalGapHours===0 },
            { label:'Créateurs', value: creators.length, ok: true },
            { label:'Heures totales possibles', value:'60h', ok: true },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0', k.ok?'bg-green-100 text-green-600':'bg-red-100 text-red-600')}>
                {k.ok ? <Check size={16}/> : <AlertTriangle size={16}/>}
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{k.label}</p>
                <p className="text-xl font-black text-gray-900">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Grid view */}
        {view === 'grid' && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: `${Math.max(700, creators.length * 150 + 200)}px` }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-100" style={{minWidth:'130px'}}>
                      Jour
                    </th>
                    {creators.map((c, i) => (
                      <th key={c.id} className="px-3 py-3.5 border-r border-gray-100 last:border-r-0 bg-gray-50" style={{minWidth:'145px'}}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-black shrink-0" style={{background:COLORS[i%COLORS.length]}}>{c.name[0]}</div>
                          <span className="text-xs font-bold text-gray-700 truncate">{c.name}</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wide bg-gray-50" style={{minWidth:'150px'}}>Couverture</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, di) => {
                    const { daySlots, gaps, covered } = dayAnalysis[di]
                    const today = isToday(di)
                    return (
                      <tr key={day} className={cn('border-b border-gray-50 last:border-0', today && 'bg-blue-50/30')}>
                        <td className={cn('sticky left-0 z-10 px-4 py-3 border-r border-gray-100', today ? 'bg-blue-50' : 'bg-white')}>
                          <div className="flex items-center gap-2.5">
                            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black',
                              covered ? 'bg-green-500' : gaps.length > 0 ? 'bg-red-400' : 'bg-gray-200')}>
                              {covered ? <Check size={10}/> : gaps.length > 0 ? '!' : null}
                            </div>
                            <div>
                              <p className={cn('text-sm font-bold', today ? 'text-blue-600' : 'text-gray-800')}>{day}</p>
                              <p className="text-xs text-gray-400">{dayDate(di)}</p>
                            </div>
                          </div>
                        </td>
                        {creators.map(c => (
                          <td key={c.id} className="px-2 py-2 border-r border-gray-100 last:border-r-0">
                            <SlotPicker value={getSlot(di, c.id)} onChange={slot => setSlot(di, c.id, slot)} saving={saving}/>
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <div className="space-y-1.5">
                            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                              {Object.entries(daySlots).map(([id, slot]) => {
                                const cov = getCov(slot); if (!cov) return null
                                return <div key={id} className="absolute top-0 bottom-0 bg-green-400 opacity-70" style={{left:`${((cov.start-SHOP_OPEN)/TOTAL)*100}%`,width:`${((cov.end-cov.start)/TOTAL)*100}%`}}/>
                              })}
                              {gaps.map((g, i) => <div key={i} className="absolute top-0 bottom-0 bg-red-400 opacity-70" style={{left:`${((g.start-SHOP_OPEN)/TOTAL)*100}%`,width:`${((g.end-g.start)/TOTAL)*100}%`}}/>)}
                            </div>
                            {covered
                              ? <p className="text-xs font-semibold text-green-600">✓ Couverte</p>
                              : gaps.length > 0
                              ? gaps.map((g,i) => <p key={i} className="text-xs font-semibold text-red-500">⚠ {g.start}h–{g.end}h</p>)
                              : <p className="text-xs text-gray-300">—</p>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coverage view */}
        {view === 'coverage' && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Couverture horaire</p>
              <p className="text-xs text-gray-400 mt-0.5">Nombre de créateurs présents par heure</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-gray-500 font-medium w-28">Jour</th>
                    {HOURS.map(h => <th key={h} className="px-1 py-3 text-center text-gray-400 font-medium w-10">{h}h</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, di) => {
                    const { daySlots, covered } = dayAnalysis[di]
                    return (
                      <tr key={day} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', covered ? 'bg-green-500' : 'bg-red-400')}/>
                            <span className="font-semibold text-gray-700">{day}</span>
                          </div>
                        </td>
                        {HOURS.map(h => {
                          const covering = creators.filter(c => {
                            const s = daySlots[c.id]; if (!s) return false
                            const cov = getCov(s); return cov && h >= cov.start && h < cov.end
                          })
                          const isEmpty = covering.length === 0
                          return (
                            <td key={h} className="px-0.5 py-1.5 text-center">
                              <div className={cn('rounded-md py-1.5 text-xs font-semibold mx-0.5', isEmpty ? 'bg-red-50 text-red-400 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100')}
                                title={isEmpty ? 'Personne' : covering.map(c => c.name).join(', ')}>
                                {isEmpty ? '—' : covering.length}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-100 border border-green-200 rounded inline-block"/> Créateurs présents</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-100 border border-red-200 rounded inline-block"/> Créneau vide</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Créneaux disponibles</p>
          {SLOTS.map(t => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background:t.bg}}>
              <div className="w-2.5 h-2.5 rounded-full" style={{background:t.color}}/>
              <span className="text-xs font-semibold" style={{color:t.color}}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
