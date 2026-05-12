'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, X, CheckCircle, Trash2, Pencil, Filter,
  AlertTriangle, Info, DollarSign, CheckSquare, Clock, Search,
} from 'lucide-react'
import { getNotes, createNote, resolveNote, deleteNote, updateNote, getAllBrands } from '@/lib/supabase'
import { useAuthStore } from '@/hooks/useAuth'
import { Button, Input, Spinner, ConfirmDialog, cn } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────
type NoteType = 'info' | 'finance' | 'urgent' | 'task'
type Note = {
  id: string; content: string; type: NoteType
  brand_id: string | null; brand?: { id: string; name: string } | null
  seller_id: string | null; seller_name: string | null
  resolved: boolean; resolved_by: string | null; resolved_at: string | null
  created_at: string; updated_at: string
}

// ─── Config par type ──────────────────────────────────────────
const TYPE_CFG: Record<NoteType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  info:    { label: 'Info',     icon: Info,          color: '#2563eb', bg: '#EFF6FF', border: '#BFDBFE' },
  finance: { label: 'Finance',  icon: DollarSign,    color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  urgent:  { label: 'Urgent',   icon: AlertTriangle, color: '#dc2626', bg: '#FEF2F2', border: '#FECACA' },
  task:    { label: 'Tâche',    icon: CheckSquare,   color: '#7c3aed', bg: '#F5F3FF', border: '#DDD6FE' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'À l\'instant'
  if (m < 60)  return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)   return `Il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── NoteCard ─────────────────────────────────────────────────
function NoteCard({ note, onResolve, onDelete, onEdit, canDelete }: {
  note: Note
  onResolve: () => void
  onDelete: () => void
  onEdit: () => void
  canDelete: boolean
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const cfg  = TYPE_CFG[note.type]
  const Icon = cfg.icon

  return (
    <div className={cn(
      'rounded-2xl border p-4 transition-all',
      note.resolved
        ? 'bg-gray-50 border-gray-100 opacity-60'
        : `border-[${cfg.border}]`
    )}
    style={{ borderColor: note.resolved ? undefined : cfg.border, background: note.resolved ? undefined : cfg.bg }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Type badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
            style={{ background: note.resolved ? '#F3F4F6' : `${cfg.color}18`, color: note.resolved ? '#9CA3AF' : cfg.color }}>
            <Icon size={11}/>
            {cfg.label}
          </div>
          {/* Brand tag */}
          {note.brand?.name && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-gray-900/5 text-gray-600 rounded-full shrink-0">
              🏷 {note.brand.name}
            </span>
          )}
          {note.resolved && (
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              ✓ Résolu
            </span>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!note.resolved && (
            <>
              <button onClick={onEdit}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-all">
                <Pencil size={12}/>
              </button>
              <button onClick={onResolve}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/60"
                title="Marquer comme résolu"
                style={{ color: cfg.color }}>
                <CheckCircle size={14}/>
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => setConfirmDel(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-white/60 transition-all">
              <Trash2 size={12}/>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', note.resolved ? 'text-gray-400 line-through' : 'text-gray-800')}>
        {note.content}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={10}/> {timeAgo(note.created_at)}
        </span>
        {note.seller_name && (
          <span className="text-xs text-gray-400">par {note.seller_name}</span>
        )}
        {note.resolved && note.resolved_by && (
          <span className="text-xs text-gray-400">résolu par {note.resolved_by}</span>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => { setConfirmDel(false); onDelete() }}
        title="Supprimer cette note ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  )
}

// ─── Note form (create / edit) ────────────────────────────────
function NoteForm({ brands, onSave, onCancel, existing }: {
  brands: any[]
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  existing?: Note | null
}) {
  const [content, setContent]   = useState(existing?.content ?? '')
  const [type, setType]         = useState<NoteType>(existing?.type ?? 'info')
  const [brandId, setBrandId]   = useState<string>(existing?.brand_id ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 100) }, [])

  const handleSave = async () => {
    if (!content.trim()) return setError('Le contenu est obligatoire')
    setSaving(true); setError('')
    try {
      await onSave({ content: content.trim(), type, brand_id: brandId || null })
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">{existing ? 'Modifier la note' : 'Nouvelle note'}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(Object.entries(TYPE_CFG) as [NoteType, typeof TYPE_CFG[NoteType]][]).map(([id, cfg]) => {
          const Icon = cfg.icon
          return (
            <button key={id} onClick={() => setType(id)}
              className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all',
                type === id ? 'text-white border-transparent' : 'border-gray-100 text-gray-500 bg-gray-50 hover:border-gray-300'
              )}
              style={type === id ? { background: cfg.color, borderColor: cfg.color } : {}}>
              <Icon size={13}/> {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <textarea
        ref={textRef}
        rows={4}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={
          type === 'finance'  ? 'Ex: Romeda doit 45 € à Creation For You (paiement du stock de novembre)' :
          type === 'urgent'   ? 'Ex: Fermeture exceptionnelle samedi — prévenir les créateurs' :
          type === 'task'     ? 'Ex: Commander les sachets kraft avant vendredi' :
          'Ex: Rappel : la réunion mensuelle est le 15 à 18h'
        }
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
      />

      {/* Brand filter (optional) */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">
          Concerne une marque ? (optionnel)
        </label>
        <select value={brandId} onChange={e => setBrandId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="">— Toute l'équipe</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">Annuler</Button>
        <Button onClick={handleSave} disabled={saving || !content.trim()} className="flex-1 gap-2">
          {saving ? <Spinner size="sm"/> : existing ? 'Enregistrer' : 'Publier'}
        </Button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function NotesPage() {
  const { seller }              = useAuthStore()
  const [notes, setNotes]       = useState<Note[]>([])
  const [brands, setBrands]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Note | null>(null)
  const [filterType, setFilterType]   = useState<string>('all')
  const [filterBrand, setFilterBrand] = useState<string>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [search, setSearch]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [n, b] = await Promise.all([getNotes(), getAllBrands()])
      setNotes(n as Note[])
      setBrands(b as any[])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (data: any) => {
    await createNote({ ...data, seller_id: seller?.id ?? null, seller_name: seller?.name ?? null })
    setShowForm(false)
    load()
  }

  const handleEdit = async (data: any) => {
    if (!editing) return
    await updateNote(editing.id, data)
    setEditing(null)
    load()
  }

  const handleResolve = async (id: string) => {
    await resolveNote(id, seller?.name ?? 'Équipe')
    load()
  }

  const handleDelete = async (id: string) => {
    await deleteNote(id)
    load()
  }

  const filtered = useMemo(() => {
    let list = notes
    if (!showResolved)         list = list.filter(n => !n.resolved)
    if (filterType !== 'all')  list = list.filter(n => n.type === filterType)
    if (filterBrand !== 'all') list = list.filter(n => n.brand_id === filterBrand)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.content.toLowerCase().includes(q) ||
        n.brand?.name?.toLowerCase().includes(q) ||
        n.seller_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [notes, showResolved, filterType, filterBrand, search])

  const activeCount   = notes.filter(n => !n.resolved).length
  const urgentCount   = notes.filter(n => !n.resolved && n.type === 'urgent').length
  const financeCount  = notes.filter(n => !n.resolved && n.type === 'finance').length
  const taskCount     = notes.filter(n => !n.resolved && n.type === 'task').length

  const isManager = seller?.role === 'manager'

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className=" mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notes équipe</h1>
            <p className="text-gray-500 text-sm mt-0.5">Partagez infos, tâches et rappels avec toute l'équipe</p>
          </div>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setEditing(null) }} className="gap-2 shrink-0">
              <Plus size={15}/> Nouvelle note
            </Button>
          )}
        </div>

        {/* KPIs */}
        {activeCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'En cours', value: activeCount, color: 'text-gray-900', bg: 'bg-white' },
              { label: 'Urgent',   value: urgentCount,  color: urgentCount > 0 ? 'text-red-600' : 'text-gray-300', bg: urgentCount > 0 ? 'bg-red-50' : 'bg-white' },
              { label: 'Finance',  value: financeCount, color: financeCount > 0 ? 'text-green-600' : 'text-gray-300', bg: financeCount > 0 ? 'bg-green-50' : 'bg-white' },
              { label: 'Tâches',   value: taskCount,    color: taskCount > 0 ? 'text-purple-600' : 'text-gray-300', bg: taskCount > 0 ? 'bg-purple-50' : 'bg-white' },
            ].map(k => (
              <div key={k.label} className={cn('border border-gray-100 rounded-2xl p-3 text-center shadow-sm', k.bg)}>
                <p className={cn('text-2xl font-black', k.color)}>{k.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        {(showForm || editing) && (
          <NoteForm
            brands={brands}
            existing={editing}
            onSave={editing ? handleEdit : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        )}

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une note…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"/>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Type filters */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1">
              {[{id:'all',label:'Tous'},...Object.entries(TYPE_CFG).map(([id,cfg])=>({id,label:cfg.label}))].map(f => (
                <button key={f.id} onClick={() => setFilterType(f.id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    filterType===f.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700')}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Brand filter */}
            {brands.length > 0 && (
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none">
                <option value="all">Toutes les marques</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {/* Show resolved toggle */}
            <button onClick={() => setShowResolved(v => !v)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ml-auto',
                showResolved ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
              <CheckCircle size={12}/> {showResolved ? 'Masquer résolus' : 'Voir résolus'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg"/></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-semibold text-gray-700">
              {notes.filter(n=>!n.resolved).length === 0
                ? 'Aucune note active — publiez la première !'
                : 'Aucune note correspondant aux filtres'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                canDelete={isManager || note.seller_id === seller?.id}
                onResolve={() => handleResolve(note.id)}
                onDelete={() => handleDelete(note.id)}
                onEdit={() => { setEditing(note); setShowForm(false) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
