'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Check,
  ThumbsUp, ThumbsDown, Trash2, Calendar, Clock, AlertTriangle,
} from 'lucide-react'
import {
  getLeaveRequests, createLeaveRequest, reviewLeaveRequest,
  deleteLeaveRequest, getSellers,
} from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Button, Spinner, ConfirmDialog, cn, DatePicker } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────
type LeaveStatus = 'pending' | 'approved' | 'rejected'
type LeaveType   = 'conge' | 'rtt' | 'maladie' | 'formation' | 'autre'

type LeaveRequest = {
  id:           string
  seller_id:    string
  seller_name:  string
  date_from:    string
  date_to:      string
  type:         LeaveType
  reason:       string | null
  status:       LeaveStatus
  manager_note: string | null
  reviewed_by:  string | null
  reviewed_at:  string | null
  created_at:   string
  seller?:      { id: string; name: string; role: string } | null
}

// ─── Config ───────────────────────────────────────────────────
const TYPE_CFG: Record<LeaveType, { label: string; color: string; bg: string }> = {
  conge:     { label: 'Congé',      color: '#3B82F6', bg: '#EFF6FF' },
  rtt:       { label: 'RTT',        color: '#8B5CF6', bg: '#F5F3FF' },
  maladie:   { label: 'Maladie',    color: '#EF4444', bg: '#FEF2F2' },
  formation: { label: 'Formation',  color: '#F59E0B', bg: '#FFFBEB' },
  autre:     { label: 'Autre',      color: '#6B7280', bg: '#F9FAFB' },
}

const STATUS_CFG: Record<LeaveStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'En attente', color: '#D97706', bg: '#FFFBEB', icon: '⏳' },
  approved: { label: 'Approuvé',   color: '#059669', bg: '#ECFDF5', icon: '✅' },
  rejected: { label: 'Refusé',     color: '#DC2626', bg: '#FEF2F2', icon: '❌' },
}

const SELLER_COLORS = [
  '#6366F1','#0EA5E9','#10B981','#F59E0B',
  '#EF4444','#8B5CF6','#EC4899','#14B8A6',
]

// ─── Date helpers (local, pas UTC) ───────────────────────────
function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function parseLocal(s: string): Date {
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y, m-1, d)
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function firstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1  // lundi=0
}
function formatDate(s: string): string {
  return parseLocal(s).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
}
function diffDays(from: string, to: string): number {
  return Math.round((parseLocal(to).getTime() - parseLocal(from).getTime()) / 86400000) + 1
}

// ─── Request card ─────────────────────────────────────────────
function LeaveCard({ req, isManager, currentSellerId, onApprove, onReject, onDelete }: {
  req: LeaveRequest
  isManager: boolean
  currentSellerId: string
  onApprove: () => void
  onReject:  () => void
  onDelete:  () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [reviewing, setReviewing]   = useState(false)

  const type   = TYPE_CFG[req.type]
  const status = STATUS_CFG[req.status]
  const days   = diffDays(req.date_from, req.date_to)
  const isMine = req.seller_id === currentSellerId

  const doReject = async () => {
    setReviewing(true)
    await onReject()
    setShowReject(false)
    setReviewing(false)
  }

  return (
    <div className={cn(
      'border rounded-2xl overflow-hidden bg-white',
      req.status === 'pending'  ? 'border-amber-200' :
      req.status === 'approved' ? 'border-green-200' : 'border-red-100'
    )}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: SELLER_COLORS[req.seller_name.charCodeAt(0) % SELLER_COLORS.length] }}>
              {req.seller_name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{req.seller_name}</p>
              <p className="text-xs text-gray-400">
                {formatDate(req.date_from)}
                {req.date_from !== req.date_to && ` → ${formatDate(req.date_to)}`}
                {' · '}{days} jour{days > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: type.color, background: type.bg }}>
              {type.label}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: status.color, background: status.bg }}>
              {status.icon} {status.label}
            </span>
          </div>
        </div>

        {/* Reason */}
        {req.reason && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 italic">
            "{req.reason}"
          </p>
        )}

        {/* Manager note */}
        {req.manager_note && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <span className="font-semibold text-gray-700">Note gérant :</span>
            {req.manager_note}
          </p>
        )}

        {/* Reviewed by */}
        {req.reviewed_by && (
          <p className="text-xs text-gray-400">
            {status.label} par {req.reviewed_by}
            {req.reviewed_at && ` · ${new Date(req.reviewed_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}`}
          </p>
        )}

        {/* Reject note form */}
        {showReject && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-600">Motif de refus (optionnel)</p>
            <input type="text" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="Ex: Période trop chargée…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReject(false)}>Annuler</Button>
              <Button size="sm" onClick={doReject} disabled={reviewing}
                className="bg-red-600 hover:bg-red-700 gap-1.5">
                {reviewing ? <Spinner size="sm"/> : <><ThumbsDown size={12}/> Confirmer le refus</>}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!showReject && (
          <div className="flex gap-2 pt-1 border-t border-gray-50">
            {/* Manager: approve / reject pending */}
            {isManager && req.status === 'pending' && (
              <>
                <Button size="sm" onClick={onApprove}
                  className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700">
                  <ThumbsUp size={12}/> Approuver
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowReject(true)}
                  className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                  <ThumbsDown size={12}/> Refuser
                </Button>
              </>
            )}
            {/* Delete: vendeur peut supprimer ses demandes pending, manager peut tout supprimer */}
            {(isMine && req.status === 'pending' || isManager) && (
              <button onClick={() => setConfirmDel(true)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all ml-auto">
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => { setConfirmDel(false); onDelete() }}
        title="Supprimer cette demande ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  )
}

// ─── Mini calendar ────────────────────────────────────────────
function MiniCalendar({ year, month, leaves, onDayClick, onMonthChange }: {
  year:  number
  month: number
  leaves: LeaveRequest[]
  onDayClick: (d: string) => void
  onMonthChange: (y: number, m: number) => void
}) {
  const DAYS_HDR = ['L','M','M','J','V','S','D']
  const totalDays  = daysInMonth(year, month)
  const firstDay   = firstDayOfMonth(year, month)

  // Build leave map: date -> list of leaves
  const leaveMap = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {}
    for (const req of leaves) {
      const from = parseLocal(req.date_from)
      const to   = parseLocal(req.date_to)
      const cur  = new Date(from)
      while (cur <= to) {
        const k = toLocalStr(cur)
        if (!map[k]) map[k] = []
        map[k].push(req)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return map
  }, [leaves])

  const today = toLocalStr(new Date())

  const prev = () => month === 0 ? onMonthChange(year-1, 11) : onMonthChange(year, month-1)
  const next = () => month === 11 ? onMonthChange(year+1, 0) : onMonthChange(year, month+1)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all">
          <ChevronLeft size={16}/>
        </button>
        <p className="text-sm font-bold text-gray-900 capitalize">
          {new Date(year, month, 1).toLocaleDateString('fr-FR', { month:'long', year:'numeric' })}
        </p>
        <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all">
          <ChevronRight size={16}/>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-50">
        {DAYS_HDR.map((d, i) => (
          <div key={i} className={cn('text-center text-xs font-bold py-2', i === 6 ? 'text-red-400' : 'text-gray-400')}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e${i}`} className="h-10"/>
        ))}
        {/* Day cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day    = i + 1
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = dateStr === today
          const dayLeaves = leaveMap[dateStr] || []
          const approved  = dayLeaves.filter(l => l.status === 'approved')
          const pending   = dayLeaves.filter(l => l.status === 'pending')
          const dayOfWeek = (firstDay + i) % 7  // 0=Mon … 6=Sun
          const isSunday  = dayOfWeek === 6

          return (
            <button key={day} onClick={() => onDayClick(dateStr)}
              className={cn(
                'h-10 flex flex-col items-center justify-center relative transition-all hover:bg-gray-50',
                isSunday ? 'text-red-300' : 'text-gray-700',
                isToday && 'font-black',
              )}>
              {/* Today indicator */}
              {isToday && (
                <div className="absolute inset-1 rounded-xl bg-gray-900"/>
              )}
              <span className={cn('text-xs font-semibold relative z-10', isToday && 'text-white')}>
                {day}
              </span>
              {/* Leave dots */}
              {dayLeaves.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 relative z-10">
                  {approved.slice(0,3).map((l, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: SELLER_COLORS[l.seller_name.charCodeAt(0) % SELLER_COLORS.length] }}/>
                  ))}
                  {pending.length > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-50 flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-indigo-500"/>Approuvé
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-amber-400"/>En attente
        </span>
      </div>
    </div>
  )
}

// ─── New leave request form ───────────────────────────────────
function NewLeaveForm({ sellerId, sellerName, onSave, onCancel }: {
  sellerId:   string
  sellerName: string
  onSave:   (data: any) => Promise<void>
  onCancel: () => void
}) {
  const today = toLocalStr(new Date())
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(today)
  const [type,     setType]     = useState<LeaveType>('conge')
  const [reason,   setReason]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const days = diffDays(dateFrom, dateTo)

  const handleSave = async () => {
    if (!dateFrom || !dateTo) return setError('Sélectionnez les dates')
    if (dateTo < dateFrom)    return setError('La date de fin doit être après le début')
    setSaving(true); setError('')
    try {
      await onSave({ seller_id: sellerId, seller_name: sellerName, date_from: dateFrom, date_to: dateTo, type, reason: reason.trim() || null })
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Nouvelle demande de congé</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
      </div>

      {/* Type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(Object.entries(TYPE_CFG) as [LeaveType, typeof TYPE_CFG[LeaveType]][]).map(([id, cfg]) => (
          <button key={id} onClick={() => setType(id)}
            className={cn('px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all text-center',
              type === id ? 'text-white border-transparent' : 'border-gray-100 text-gray-500 bg-gray-50 hover:border-gray-300'
            )}
            style={type === id ? { background: cfg.color } : {}}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Du *</label>
          <DatePicker value={dateFrom} onChange={v => { setDateFrom(v); if (v > dateTo) setDateTo(v) }} min={today} placeholder="Du"/>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Au *</label>
          <DatePicker value={dateTo} onChange={setDateTo} min={dateFrom} placeholder="Au"/>
        </div>
      </div>

      {/* Duration indicator */}
      {dateFrom && dateTo && dateTo >= dateFrom && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-800">
            {formatDate(dateFrom)}{dateFrom !== dateTo && ` → ${formatDate(dateTo)}`}
          </span>
          <span className="text-sm font-black text-indigo-700">{days} jour{days > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Reason */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1">Motif (optionnel)</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ex: Voyage, obligation familiale…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">Annuler</Button>
        <Button onClick={handleSave} disabled={saving || !dateFrom || !dateTo} className="flex-1 gap-2">
          {saving ? <Spinner size="sm"/> : <><Calendar size={14}/> Envoyer la demande</>}
        </Button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function CongesPage() {
  const { seller } = useAuthStore()
  const isManager  = seller?.role === 'manager'

  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [leaves,   setLeaves]   = useState<LeaveRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSeller, setFilterSeller] = useState<string>('all')
  const [sellers,  setSellers]  = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [l, s] = await Promise.all([
        getLeaveRequests({ year: calYear }),
        isManager ? getSellers() : Promise.resolve([]),
      ])
      setLeaves(l as LeaveRequest[])
      if (isManager) setSellers((s as any[]) || [])
    } finally { setLoading(false) }
  }, [calYear, isManager])

  useEffect(() => { load() }, [load])

  const handleCreate = async (data: any) => {
    await createLeaveRequest(data)
    setShowForm(false)
    load()
  }

  const handleApprove = async (id: string) => {
    await reviewLeaveRequest(id, 'approved', seller?.name ?? 'Manager')
    load()
  }

  const handleReject = async (id: string) => {
    await reviewLeaveRequest(id, 'rejected', seller?.name ?? 'Manager')
    load()
  }

  const handleDelete = async (id: string) => {
    await deleteLeaveRequest(id)
    load()
  }

  // Filtered list
  const filtered = useMemo(() => {
    let list = leaves
    // Vendeur ne voit que ses propres demandes
    if (!isManager) list = list.filter(l => l.seller_id === seller?.id)
    if (filterStatus !== 'all')  list = list.filter(l => l.status === filterStatus)
    if (filterSeller !== 'all')  list = list.filter(l => l.seller_id === filterSeller)
    // Filter by selected day
    if (selectedDay) {
      list = list.filter(l => {
        const from = parseLocal(l.date_from)
        const to   = parseLocal(l.date_to)
        const day  = parseLocal(selectedDay)
        return day >= from && day <= to
      })
    }
    return list
  }, [leaves, isManager, seller?.id, filterStatus, filterSeller, selectedDay])

  // KPIs
  const myLeaves      = leaves.filter(l => l.seller_id === seller?.id)
  const pendingCount  = (isManager ? leaves : myLeaves).filter(l => l.status === 'pending').length
  const approvedCount = (isManager ? leaves : myLeaves).filter(l => l.status === 'approved').length
  const totalDaysUsed = myLeaves.filter(l => l.status === 'approved').reduce((s, l) => s + diffDays(l.date_from, l.date_to), 0)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Congés & Absences</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isManager ? 'Gérez les demandes de toute l\'équipe' : 'Posez et suivez vos demandes'}
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2 shrink-0">
              <Plus size={15}/> Demander un congé
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className={cn('text-2xl font-black', pendingCount > 0 ? 'text-amber-500' : 'text-gray-300')}>
              {pendingCount}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{isManager ? 'En attente' : 'Mes demandes'}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-green-600">{approvedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Approuvés</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-gray-900">{totalDaysUsed}</p>
            <p className="text-xs text-gray-400 mt-0.5">Mes jours pris</p>
          </div>
        </div>

        {/* Form */}
        {showForm && seller && (
          <NewLeaveForm
            sellerId={seller.id}
            sellerName={seller.name}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Calendar */}
        <MiniCalendar
          year={calYear} month={calMonth}
          leaves={isManager ? leaves : leaves.filter(l => l.seller_id === seller?.id)}
          onDayClick={d => setSelectedDay(prev => prev === d ? null : d)}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m) }}
        />

        {/* Selected day info */}
        {selectedDay && (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
            <p className="text-sm font-semibold text-indigo-800">
              📅 {parseLocal(selectedDay).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
              {' — '}{filtered.length} demande{filtered.length > 1 ? 's' : ''}
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-indigo-400 hover:text-indigo-700">
              <X size={14}/>
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Status */}
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1">
            {[
              { id:'all',      label:'Toutes' },
              { id:'pending',  label:'⏳ En attente' },
              { id:'approved', label:'✅ Approuvées' },
              { id:'rejected', label:'❌ Refusées' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterStatus(f.id)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  filterStatus === f.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700')}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Seller filter (manager only) */}
          {isManager && sellers.length > 0 && (
            <select value={filterSeller} onChange={e => setFilterSeller(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none">
              <option value="all">Toute l'équipe</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {/* Year nav */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setCalYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
              <ChevronLeft size={13}/>
            </button>
            <span className="text-sm font-bold text-gray-700 px-1">{calYear}</span>
            <button onClick={() => setCalYear(y => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
              <ChevronRight size={13}/>
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg"/></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <p className="text-3xl mb-3">🏖</p>
            <p className="text-sm font-semibold text-gray-700">
              {selectedDay ? 'Aucune demande ce jour' :
               filterStatus !== 'all' ? 'Aucune demande dans cette catégorie' :
               isManager ? 'Aucune demande de congé' : 'Vous n\'avez pas encore de demande'}
            </p>
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                + Faire une demande
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => (
              <LeaveCard
                key={req.id}
                req={req}
                isManager={isManager}
                currentSellerId={seller?.id ?? ''}
                onApprove={() => handleApprove(req.id)}
                onReject={() => handleReject(req.id)}
                onDelete={() => handleDelete(req.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
