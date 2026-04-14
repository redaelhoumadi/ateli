'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getBrands } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const SHOP_OPEN  = 10  // 10h
const SHOP_CLOSE = 20  // 20h

const TIME_SLOTS = [
  { id: 'morning',   label: '10h–14h', start: 10, end: 14, color: '#3B82F6' },
  { id: 'afternoon', label: '14h–20h', start: 14, end: 20, color: '#10B981' },
  { id: 'full',      label: '10h–20h', start: 10, end: 20, color: '#6366F1' },
  { id: 'custom',    label: 'Perso…',  start: 0,  end: 0,  color: '#F59E0B' },
  { id: 'off',       label: 'Pas dispo', start: 0, end: 0, color: '#EF4444' },
]

const CUSTOM_HOURS = Array.from({ length: 11 }, (_, i) => i + 10) // 10..20

type SlotId = typeof TIME_SLOTS[number]['id']

type CreatorSlot = {
  slotId: SlotId
  customStart?: number
  customEnd?: number
}

// planningData[weekKey][dayIndex][creatorId] = CreatorSlot
type PlanningData = Record<string, Record<number, Record<string, CreatorSlot>>>

// creator = brand for this concept store
type Creator = { id: string; name: string }

// ─── Helpers ─────────────────────────────────────────────────
function getWeekKey(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getMondayOfWeek(weekKey: string) {
  return new Date(weekKey + 'T00:00:00')
}

function addWeeks(weekKey: string, n: number) {
  const d = getMondayOfWeek(weekKey)
  d.setDate(d.getDate() + n * 7)
  return getWeekKey(d)
}

function formatWeekRange(weekKey: string) {
  const mon = getMondayOfWeek(weekKey)
  const sat = new Date(mon); sat.setDate(mon.getDate() + 5)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${mon.toLocaleDateString('fr-FR', opts)} – ${sat.toLocaleDateString('fr-FR', opts)}`
}

function getSlotCoverage(slot: CreatorSlot): { start: number; end: number } | null {
  if (slot.slotId === 'off') return null
  const def = TIME_SLOTS.find((t) => t.id === slot.slotId)!
  if (slot.slotId === 'custom') {
    return (slot.customStart != null && slot.customEnd != null && slot.customEnd > slot.customStart)
      ? { start: slot.customStart, end: slot.customEnd }
      : null
  }
  return { start: def.start, end: def.end }
}

/** Returns uncovered hours [start, end] pairs for a day */
function getGaps(daySlots: Record<string, CreatorSlot>): Array<{ start: number; end: number }> {
  // Build coverage array
  const covered = new Set<number>()
  Object.values(daySlots).forEach((slot) => {
    const cov = getSlotCoverage(slot)
    if (cov) {
      for (let h = cov.start; h < cov.end; h++) covered.add(h)
    }
  })

  const gaps: Array<{ start: number; end: number }> = []
  let gapStart: number | null = null
  for (let h = SHOP_OPEN; h < SHOP_CLOSE; h++) {
    if (!covered.has(h)) {
      if (gapStart === null) gapStart = h
    } else {
      if (gapStart !== null) { gaps.push({ start: gapStart, end: h }); gapStart = null }
    }
  }
  if (gapStart !== null) gaps.push({ start: gapStart, end: SHOP_CLOSE })
  return gaps
}

function isDayCovered(daySlots: Record<string, CreatorSlot>): boolean {
  return getGaps(daySlots).length === 0
}

// ─── Slot picker dropdown ─────────────────────────────────────
function SlotPicker({
  value,
  onChange,
}: {
  value: CreatorSlot | undefined
  onChange: (slot: CreatorSlot) => void
}) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customStart, setCustomStart] = useState(10)
  const [customEnd, setCustomEnd] = useState(14)

  const current = value ?? { slotId: 'off' as SlotId }
  const currentDef = TIME_SLOTS.find((t) => t.id === current.slotId) ?? TIME_SLOTS[4]

  const displayLabel = () => {
    if (current.slotId === 'custom' && current.customStart != null && current.customEnd != null) {
      return `${current.customStart}h–${current.customEnd}h`
    }
    return currentDef.label
  }

  const bgColor = current.slotId === 'off' ? '#EF444420' : `${currentDef.color}20`
  const textColor = currentDef.color

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setShowCustom(false) }}
        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
        style={{ background: bgColor, color: textColor, border: `1px solid ${textColor}30` }}
      >
        <span className="truncate">{displayLabel()}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
          {TIME_SLOTS.filter((t) => t.id !== 'custom').map((t) => (
            <button
              key={t.id}
              onClick={() => { onChange({ slotId: t.id as SlotId }); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
              <span style={{ color: t.id === current.slotId ? t.color : '#374151' }}>{t.label}</span>
              {t.id === current.slotId && (
                <svg className="ml-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
          {/* Custom slot */}
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
              <span style={{ color: current.slotId === 'custom' ? '#F59E0B' : '#374151' }}>
                {current.slotId === 'custom' ? displayLabel() : 'Horaire perso…'}
              </span>
            </button>
          ) : (
            <div className="border-t border-gray-100 p-3 space-y-2">
              <p className="text-xs font-bold text-gray-700">Horaire perso</p>
              <div className="flex items-center gap-2">
                <select
                  value={customStart}
                  onChange={(e) => setCustomStart(Number(e.target.value))}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  {CUSTOM_HOURS.slice(0, -1).map((h) => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">→</span>
                <select
                  value={customEnd}
                  onChange={(e) => setCustomEnd(Number(e.target.value))}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  {CUSTOM_HOURS.slice(1).map((h) => (
                    <option key={h} value={h} disabled={h <= customStart}>{h}h</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (customEnd > customStart) {
                    onChange({ slotId: 'custom', customStart, customEnd })
                    setOpen(false)
                    setShowCustom(false)
                  }
                }}
                className="w-full py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
              >
                Valider
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Timeline bar for a day ───────────────────────────────────
function DayCoverageBar({ daySlots, gaps }: {
  daySlots: Record<string, CreatorSlot>
  gaps: Array<{ start: number; end: number }>
}) {
  const TOTAL = SHOP_CLOSE - SHOP_OPEN // 10h

  return (
    <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden flex">
      {/* Covered zones per creator */}
      {Object.entries(daySlots).map(([id, slot]) => {
        const cov = getSlotCoverage(slot)
        if (!cov) return null
        const left = ((cov.start - SHOP_OPEN) / TOTAL) * 100
        const width = ((cov.end - cov.start) / TOTAL) * 100
        return (
          <div
            key={id}
            className="absolute top-0 bottom-0 opacity-70"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              background: '#10B981',
            }}
          />
        )
      })}
      {/* Gap zones */}
      {gaps.map((g, i) => {
        const left = ((g.start - SHOP_OPEN) / TOTAL) * 100
        const width = ((g.end - g.start) / TOTAL) * 100
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0 bg-red-400 opacity-70"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        )
      })}
      {/* Hour markers */}
      {[12, 14, 16, 18].map((h) => (
        <div
          key={h}
          className="absolute top-0 bottom-0 w-px bg-white/50"
          style={{ left: `${((h - SHOP_OPEN) / TOTAL) * 100}%` }}
        />
      ))}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function PlanningPage() {
  const [creators, setCreators]   = useState<Creator[]>([])
  const [weekKey, setWeekKey]     = useState(getWeekKey(new Date()))
  const [planning, setPlanning]   = useState<PlanningData>({})
  const [loading, setLoading]     = useState(true)
  const [activeDay, setActiveDay] = useState<number | null>(null)

  // Load creators (brands) from Supabase
  useEffect(() => {
    getBrands().then((data) => {
      setCreators((data || []) as Creator[])
    }).finally(() => setLoading(false))
  }, [])

  // Load planning from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ateli_planning')
      if (stored) setPlanning(JSON.parse(stored))
    } catch {}
  }, [])

  const savePlanning = useCallback((next: PlanningData) => {
    setPlanning(next)
    localStorage.setItem('ateli_planning', JSON.stringify(next))
  }, [])

  const getSlot = (dayIdx: number, creatorId: string): CreatorSlot | undefined => {
    return planning[weekKey]?.[dayIdx]?.[creatorId]
  }

  const setSlot = (dayIdx: number, creatorId: string, slot: CreatorSlot) => {
    const next = structuredClone(planning)
    if (!next[weekKey]) next[weekKey] = {}
    if (!next[weekKey][dayIdx]) next[weekKey][dayIdx] = {}
    next[weekKey][dayIdx][creatorId] = slot
    savePlanning(next)
  }

  // Per-day analysis
  const dayAnalysis = useMemo(() => {
    return DAYS.map((_, dayIdx) => {
      const daySlots = planning[weekKey]?.[dayIdx] ?? {}
      const gaps = getGaps(daySlots)
      const covered = gaps.length === 0
      return { daySlots, gaps, covered }
    })
  }, [planning, weekKey])

  const coveredCount = dayAnalysis.filter((d) => d.covered).length

  // Week summary stats
  const weekStats = useMemo(() => {
    let totalGapHours = 0
    dayAnalysis.forEach(({ gaps }) => {
      gaps.forEach((g) => { totalGapHours += g.end - g.start })
    })
    return { totalGapHours }
  }, [dayAnalysis])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-full px-6 py-8">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning boutique</h1>
            <p className="text-gray-500 text-sm">Horaires d'ouverture 10h – 20h · Lundi au Samedi</p>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekKey(addWeeks(weekKey, -1))}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:border-gray-400 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{formatWeekRange(weekKey)}</p>
              {weekKey === getWeekKey(new Date()) && (
                <p className="text-xs text-blue-500 font-medium">Semaine actuelle</p>
              )}
            </div>
            <button
              onClick={() => setWeekKey(addWeeks(weekKey, 1))}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:border-gray-400 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button
              onClick={() => setWeekKey(getWeekKey(new Date()))}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* ── Week status bar ──────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${
              coveredCount === 6 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
            }`}>
              {coveredCount === 6 ? '✓' : coveredCount}
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Jours couverts</p>
              <p className="text-lg font-black text-gray-900">{coveredCount} / 6</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${
              weekStats.totalGapHours === 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {weekStats.totalGapHours === 0 ? '✓' : '!'}
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Créneaux vides</p>
              <p className="text-lg font-black text-gray-900">{weekStats.totalGapHours}h manquantes</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">
              {creators.length}
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Créateurs</p>
              <p className="text-lg font-black text-gray-900">{creators.length} marques</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 font-black text-sm">
              60h
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">À couvrir</p>
              <p className="text-lg font-black text-gray-900">6 × 10h</p>
            </div>
          </div>
        </div>

        {/* ── Main grid ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: `${Math.max(900, creators.length * 140 + 280)}px` }}>
              <thead>
                {/* Creator header row */}
                <tr className="border-b border-gray-100">
                  <th className="sticky left-0 z-10 bg-white text-left px-5 py-4 w-36 border-r border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Semaine</p>
                  </th>
                  <th className="px-3 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide w-28 border-r border-gray-100">
                    Jour
                  </th>
                  {creators.map((c, i) => {
                    const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
                    const color = COLORS[i % COLORS.length]
                    return (
                      <th key={c.id} className="px-3 py-4 border-r border-gray-100 last:border-r-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-black shrink-0"
                            style={{ background: color }}>
                            {c.name[0]}
                          </div>
                          <span className="text-xs font-bold text-gray-700 truncate">{c.name}</span>
                        </div>
                      </th>
                    )
                  })}
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide w-48">
                    Couverture
                  </th>
                </tr>
              </thead>

              <tbody>
                {DAYS.map((day, dayIdx) => {
                  const { daySlots, gaps, covered } = dayAnalysis[dayIdx]
                  const monday = getMondayOfWeek(weekKey)
                  const dayDate = new Date(monday)
                  dayDate.setDate(monday.getDate() + dayIdx)
                  const dateStr = dayDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  const isToday = dayDate.toDateString() === new Date().toDateString()

                  return (
                    <tr
                      key={day}
                      className={`border-b border-gray-50 last:border-0 transition-colors ${
                        isToday ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      {/* Week label — only on first row */}
                      {dayIdx === 0 && (
                        <td
                          rowSpan={6}
                          className="sticky left-0 z-10 bg-white border-r border-gray-100 px-5 text-center align-middle"
                          style={{ background: 'white' }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-xs font-semibold text-gray-500">
                              {formatWeekRange(weekKey).split('–')[0].trim()}
                            </p>
                            <p className="text-xs text-gray-400">–</p>
                            <p className="text-xs font-semibold text-gray-500">
                              {formatWeekRange(weekKey).split('–')[1]?.trim()}
                            </p>
                          </div>
                        </td>
                      )}

                      {/* Day cell */}
                      <td className="px-3 py-3 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          {covered ? (
                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                            </div>
                          ) : gaps.length > 0 ? (
                            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M12 8v4M12 16h.01"/></svg>
                            </div>
                          ) : (
                            <div className="w-4 h-4 bg-gray-200 rounded-full shrink-0" />
                          )}
                          <div>
                            <p className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>{day}</p>
                            <p className="text-xs text-gray-400">{dateStr}</p>
                          </div>
                        </div>
                      </td>

                      {/* Creator slots */}
                      {creators.map((c) => (
                        <td key={c.id} className="px-2 py-3 border-r border-gray-100 last:border-r-0">
                          <SlotPicker
                            value={getSlot(dayIdx, c.id)}
                            onChange={(slot) => setSlot(dayIdx, c.id, slot)}
                          />
                        </td>
                      ))}

                      {/* Coverage column */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <DayCoverageBar daySlots={daySlots} gaps={gaps} />
                          <div className="flex items-center gap-2">
                            {covered ? (
                              <span className="text-xs font-bold text-green-600">✓ Journée couverte</span>
                            ) : gaps.length > 0 ? (
                              <div className="space-y-0.5">
                                {gaps.map((g, i) => (
                                  <span key={i} className="block text-xs font-semibold text-red-500">
                                    ⚠ Créneau vide {g.start}h–{g.end}h
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">Non planifié</span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Legend ──────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Légende</p>
          {TIME_SLOTS.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />
              <span className="text-xs text-gray-600 font-medium">{t.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-600 font-medium">Journée couverte</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-gray-600 font-medium">Créneau vide</span>
          </div>
          <p className="text-xs text-gray-400 ml-auto">Planning sauvegardé automatiquement</p>
        </div>
      </div>
    </div>
  )
}
