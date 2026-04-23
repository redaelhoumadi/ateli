'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Target, Plus, Save, Trash2, TrendingUp, Calendar,
  CheckCircle, AlertTriangle, Zap, Clock, ChevronLeft,
  ChevronRight, RotateCcw, Info,
} from 'lucide-react'
import {
  getSalesGoals, upsertSalesGoal, deleteSalesGoal,
  getAllGoalProgress, getSalesStats,
} from '@/lib/supabase'
import {
  Button, Card, CardHeader, CardTitle, CardContent,
  Input, Label, Separator, Spinner, StatCard,
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, cn,
} from '@/components/ui'
import type { SalesGoal, GoalProgress } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toFixed(2) + ' €'
const fmtK = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(0) + ' €'

const PERIOD_CONFIG = {
  day:   { label: 'Aujourd\'hui',   icon: '☀️', color: '#6366f1', bg: '#EEF2FF' },
  week:  { label: 'Cette semaine',  icon: '📅', color: '#0ea5e9', bg: '#F0F9FF' },
  month: { label: 'Ce mois',        icon: '🗓', color: '#10b981', bg: '#F0FDF4' },
}

const STATUS_CONFIG = {
  exceeded: { label: 'Objectif dépassé !', color: '#059669', bg: '#ECFDF5', icon: '🎉' },
  ahead:    { label: 'En avance',          color: '#0284c7', bg: '#F0F9FF', icon: '🚀' },
  on_track: { label: 'Dans les temps',     color: '#d97706', bg: '#FFFBEB', icon: '✓'  },
  at_risk:  { label: 'En retard',          color: '#dc2626', bg: '#FEF2F2', icon: '⚠️' },
  missed:   { label: 'Manqué',             color: '#9ca3af', bg: '#F9FAFB', icon: '✗'  },
}

// ─── Progress ring SVG ────────────────────────────────────────
function ProgressRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - Math.min(pct, 100) / 100 * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
    </svg>
  )
}

// ─── Goal progress card ───────────────────────────────────────
function GoalCard({ progress, periodType, onEdit }: {
  progress: GoalProgress | null
  periodType: 'day' | 'week' | 'month'
  onEdit: () => void
}) {
  const cfg    = PERIOD_CONFIG[periodType]
  const stCfg  = progress ? STATUS_CONFIG[progress.status] : null

  if (!progress) {
    return (
      <button onClick={onEdit}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-gray-400 hover:bg-gray-50 transition-all text-center group">
        <div className="w-12 h-12 bg-gray-100 group-hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
          <Plus size={20} className="text-gray-400"/>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-700">{cfg.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">Définir un objectif</p>
        </div>
      </button>
    )
  }

  const { goal, achieved, pct, remaining } = progress

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Color top bar */}
      <div className="h-1.5 w-full" style={{ background: cfg.color }}/>
      <div className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{cfg.icon}</span>
            <p className="text-sm font-bold text-gray-800">{cfg.label}</p>
          </div>
          <button onClick={onEdit}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
            Modifier
          </button>
        </div>

        {/* Ring + numbers */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <ProgressRing pct={pct} color={stCfg?.color ?? cfg.color} size={80}/>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black" style={{ color: stCfg?.color ?? cfg.color }}>
                {Math.min(pct, 999)}%
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-2xl font-black text-gray-900">{fmtK(achieved)}</p>
            <p className="text-xs text-gray-400">sur {fmtK(goal.amount)}</p>
            {stCfg && (
              <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: stCfg.bg, color: stCfg.color }}>
                {stCfg.icon} {stCfg.label}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct, 100)}%`, background: stCfg?.color ?? cfg.color }}/>
        </div>

        {/* Remaining */}
        {pct < 100 ? (
          <p className="text-xs text-gray-500 text-center">
            Il reste <strong style={{ color: stCfg?.color }}>{fmt(remaining)}</strong> à réaliser
          </p>
        ) : (
          <p className="text-xs font-bold text-center" style={{ color: stCfg?.color }}>
            🎉 Dépassé de {fmt(achieved - goal.amount)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── History sparkline ────────────────────────────────────────
function WeeklySales({ data }: { data: { day: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-lg transition-all duration-500 min-h-[2px]"
            style={{ height: `${Math.max(4, (d.total / max) * 52)}px`, background: d.total > 0 ? '#6366f1' : '#F3F4F6' }}/>
          <p className="text-[10px] text-gray-400 leading-none">{d.day}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Goal edit form ───────────────────────────────────────────
function GoalForm({ periodType, existing, onSave, onCancel }: {
  periodType: 'day' | 'week' | 'month'
  existing: SalesGoal | null
  onSave: (amount: number, note: string) => Promise<void>
  onCancel: () => void
}) {
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : '')
  const [note,   setNote]   = useState(existing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const PRESETS = periodType === 'day' ? [200, 300, 500, 750, 1000] :
                  periodType === 'week' ? [1000, 1500, 2000, 3000, 5000] :
                                         [3000, 5000, 8000, 10000, 15000]

  const handleSave = async () => {
    const n = Number(amount)
    if (!amount || isNaN(n) || n <= 0) return setError('Entrez un montant valide')
    setSaving(true); setError('')
    try { await onSave(n, note) }
    catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">{PERIOD_CONFIG[periodType].icon}</span>
        <p className="text-sm font-bold text-gray-900">
          Objectif {PERIOD_CONFIG[periodType].label.toLowerCase()}
        </p>
      </div>

      <div>
        <Label>Montant cible (€)</Label>
        <div className="relative mt-1">
          <Input type="number" min="1" step="10" placeholder="ex. 500"
            value={amount} onChange={e => setAmount(e.target.value)}
            className="pr-8 text-xl font-black" autoFocus/>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
        </div>
        {/* Presets */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              className={cn('px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                Number(amount) === p
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
              style={Number(amount) === p ? { background: PERIOD_CONFIG[periodType].color } : {}}>
              {fmtK(p)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Note (optionnel)</Label>
        <Input placeholder="Ex: Journée spéciale, objectif de lancement…"
          value={note} onChange={e => setNote(e.target.value)}/>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button size="sm" onClick={handleSave} disabled={!amount || saving} className="gap-1.5 flex-1"
          style={{ background: PERIOD_CONFIG[periodType].color }}>
          {saving ? <Spinner size="sm"/> : <><Save size={13}/> Enregistrer</>}
        </Button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function ObjectifsPage() {
  const [progress, setProgress] = useState<{ day: any; week: any; month: any } | null>(null)
  const [goals, setGoals]       = useState<SalesGoal[]>([])
  const [weekSales, setWeekSales] = useState<{ day: string; total: number }[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<'day' | 'week' | 'month' | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      // Last 7 days for chart
      const weekFrom = new Date(now); weekFrom.setDate(weekFrom.getDate() - 6); weekFrom.setHours(0,0,0,0)
      const [prog, goalsData, salesData] = await Promise.all([
        getAllGoalProgress(now),
        getSalesGoals(),
        getSalesStats(weekFrom.toISOString()),
      ])
      setProgress(prog as any)
      setGoals((goalsData as SalesGoal[]) || [])

      // Build daily chart for last 7 days
      const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
      const dailyMap = new Map<string, number>()
      ;(salesData || []).forEach((s: any) => {
        const d = new Date(s.created_at)
        const key = d.toISOString().split('T')[0]
        dailyMap.set(key, (dailyMap.get(key) || 0) + s.total)
      })
      const chart = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekFrom); d.setDate(weekFrom.getDate() + i)
        const key = d.toISOString().split('T')[0]
        return { day: DAYS[d.getDay()], total: Math.round((dailyMap.get(key) || 0) * 100) / 100 }
      })
      setWeekSales(chart)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveGoal = async (periodType: 'day' | 'week' | 'month', amount: number, note: string) => {
    const now = new Date()
    let targetDate: string
    if (periodType === 'day') {
      targetDate = now.toISOString().split('T')[0]
    } else if (periodType === 'week') {
      const d = new Date(now)
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      targetDate = d.toISOString().split('T')[0]
    } else {
      targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    }
    await upsertSalesGoal({ period_type: periodType, target_date: targetDate, amount, note: note || null })
    setEditing(null)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet objectif ?')) return
    setDeleting(id)
    try { await deleteSalesGoal(id); await load() }
    finally { setDeleting(null) }
  }

  const getGoalForPeriod = (periodType: string) =>
    goals.find(g => g.period_type === periodType && !g.brand_id) ?? null

  // KPIs from today
  const todayAchieved  = progress?.day?.achieved  ?? 0
  const weekAchieved   = progress?.week?.achieved  ?? 0
  const monthAchieved  = progress?.month?.achieved ?? 0

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Objectifs de vente</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Définissez vos objectifs et suivez la progression en temps réel
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''}/> Actualiser
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg"/></div>
          ) : (
            <>
              {/* ─── KPI strip ─── */}
              <div className="grid grid-cols-3 gap-4">
                {([
                  { label: 'Aujourd\'hui', value: todayAchieved,  icon: <Zap size={16}/> },
                  { label: '7 derniers jours', value: weekAchieved, icon: <Calendar size={16}/> },
                  { label: 'Ce mois',    value: monthAchieved, icon: <TrendingUp size={16}/> },
                ] as const).map((k, i) => (
                  <StatCard key={i} label={k.label} value={fmtK(k.value)} icon={k.icon}/>
                ))}
              </div>

              {/* ─── Progress cards ─── */}
              <div>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                  Progression des objectifs
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['day', 'week', 'month'] as const).map(pt => (
                    editing === pt ? (
                      <GoalForm
                        key={pt}
                        periodType={pt}
                        existing={getGoalForPeriod(pt)}
                        onSave={(amount, note) => handleSaveGoal(pt, amount, note)}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <GoalCard
                        key={pt}
                        periodType={pt}
                        progress={progress?.[pt] ?? null}
                        onEdit={() => setEditing(pt)}
                      />
                    )
                  ))}
                </div>
              </div>

              {/* ─── Weekly chart ─── */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={16}/>
                    CA des 7 derniers jours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {weekSales.every(d => d.total === 0) ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-400">Aucune vente sur les 7 derniers jours</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <WeeklySales data={weekSales}/>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Total : <strong className="text-gray-900">{fmtK(weekSales.reduce((s, d) => s + d.total, 0))}</strong></span>
                        <span>Moy/jour : <strong className="text-gray-900">{fmtK(weekSales.reduce((s, d) => s + d.total, 0) / 7)}</strong></span>
                        <span>Meilleur jour : <strong className="text-gray-900">{fmtK(Math.max(...weekSales.map(d => d.total)))}</strong></span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ─── Goals history ─── */}
              {goals.filter(g => !g.brand_id).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock size={16}/> Historique des objectifs
                    </CardTitle>
                  </CardHeader>
                  <div className="divide-y divide-gray-50">
                    {goals.filter(g => !g.brand_id).map(g => {
                      const cfg = PERIOD_CONFIG[g.period_type]
                      const isActive = (
                        (g.period_type === 'day'   && g.target_date === new Date().toISOString().split('T')[0]) ||
                        (g.period_type === 'week'  && progress?.week?.goal?.id  === g.id) ||
                        (g.period_type === 'month' && progress?.month?.goal?.id === g.id)
                      )
                      return (
                        <div key={g.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                          <span className="text-base shrink-0">{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {cfg.label} — {fmt(g.amount)}
                              </p>
                              {isActive && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                  style={{ background: cfg.color }}>
                                  En cours
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {new Date(g.target_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {g.note && ` · ${g.note}`}
                            </p>
                          </div>
                          <button onClick={() => handleDelete(g.id)} disabled={deleting === g.id}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                            {deleting === g.id ? <Spinner size="sm"/> : <Trash2 size={13}/>}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
