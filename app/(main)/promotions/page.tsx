'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Tag, Zap, CheckCircle, X, Pencil, Trash2, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react'
import { getPromotions, createPromotion, updatePromotion, deletePromotion, applyActivePromotions, getBrands, getProducts } from '@/lib/supabase'
import { Button, Input, Label, Spinner, DatePicker, Dialog, DialogContent, DialogTitle, ConfirmDialog, TooltipProvider, Separator, cn } from '@/components/ui'
import type { Promotion, Brand, Product } from '@/types'

const COMMON_CATEGORIES = ['Bijoux','Vêtements','Accessoires','Maison & Déco','Art','Papeterie','Beauté','Alimentaire','Enfant','Autre']

function promoStatus(p: Promotion) {
  if (!p.is_active) return { label: 'Désactivée', color: '#9ca3af', bg: '#F9FAFB', icon: '⏸' }
  const now = new Date(), from = new Date(p.starts_at), to = new Date(p.ends_at)
  if (now < from) return { label: 'Planifiée',  color: '#7c3aed', bg: '#F5F3FF', icon: '📅' }
  if (now > to)   return { label: 'Terminée',   color: '#6b7280', bg: '#F3F4F6', icon: '✓'  }
  return             { label: 'En cours',    color: '#059669', bg: '#ECFDF5', icon: '🟢' }
}
const isActive = (p: Promotion) => promoStatus(p).label === 'En cours'

function scopeLabel(promo: Promotion, brands: Brand[]) {
  if (!promo.brand_ids?.length && !promo.product_ids?.length && !promo.category_names?.length) return 'Tous les produits'
  const parts: string[] = []
  if (promo.brand_ids?.length) parts.push(`Marques : ${promo.brand_ids.map(id => brands.find(b => b.id === id)?.name).filter(Boolean).join(', ')}`)
  if (promo.category_names?.length) parts.push(`Catégories : ${promo.category_names.join(', ')}`)
  if (promo.product_ids?.length) parts.push(`${promo.product_ids.length} produit${promo.product_ids.length > 1 ? 's' : ''} spécifique${promo.product_ids.length > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

// ─── Promo card ───────────────────────────────────────────────
function PromoCard({ promo, brands, onEdit, onToggle, onDelete, onApply }: {
  promo: Promotion; brands: Brand[]
  onEdit: ()=>void; onToggle: ()=>void; onDelete: ()=>void; onApply: ()=>void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const status = promoStatus(promo)
  const active = isActive(promo)
  const fmt2 = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' })

  return (
    <div className={cn('border rounded-2xl overflow-hidden bg-white transition-all', active ? 'border-green-200 shadow-md' : 'border-gray-100 shadow-sm')}>
      {active && <div className="h-1 bg-green-400 w-full"/>}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className={cn('w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black', active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
          <span className="text-xl leading-none">-{promo.discount_pct.toFixed(0)}</span>
          <span className="text-xs">%</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">{promo.name}</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: status.color, background: status.bg }}>{status.icon} {status.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{scopeLabel(promo, brands)}</p>
          <p className="text-xs text-gray-400">{fmt2(promo.starts_at)} → {fmt2(promo.ends_at)}</p>
        </div>
        <div className="text-gray-400 shrink-0">{open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
          {promo.description && <p className="text-sm text-gray-600 italic">"{promo.description}"</p>}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Remise</span><span className="font-black text-gray-900">-{promo.discount_pct.toFixed(0)} %</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Période</span><span className="font-semibold">{fmt2(promo.starts_at)} → {fmt2(promo.ends_at)}</span></div>
            {promo.brand_ids?.length > 0 && <div className="flex justify-between"><span className="text-gray-500">Marques</span><span className="font-semibold">{promo.brand_ids.map(id => brands.find(b => b.id === id)?.name).filter(Boolean).join(', ')}</span></div>}
            {promo.category_names?.length > 0 && <div className="flex justify-between"><span className="text-gray-500">Catégories</span><span className="font-semibold">{promo.category_names.join(', ')}</span></div>}
            {promo.product_ids?.length > 0 && <div className="flex justify-between"><span className="text-gray-500">Produits ciblés</span><span className="font-semibold">{promo.product_ids.length} produit{promo.product_ids.length > 1 ? 's' : ''}</span></div>}
            {!promo.brand_ids?.length && !promo.category_names?.length && !promo.product_ids?.length && <div className="flex justify-between"><span className="text-gray-500">Périmètre</span><span className="font-semibold text-green-700">🌍 Tous les produits</span></div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={onToggle} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all', promo.is_active ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100' : 'text-green-700 border-green-200 bg-green-50 hover:bg-green-100')}>
              {promo.is_active ? <><Pause size={12}/> Désactiver</> : <><Play size={12}/> Activer</>}
            </button>
            <button onClick={onApply} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all"><Zap size={12}/> Appliquer</button>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all"><Pencil size={12}/> Modifier</button>
            <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-red-100 bg-white text-red-500 hover:bg-red-50 transition-all ml-auto"><Trash2 size={12}/></button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirmDel} onCancel={() => setConfirmDel(false)} onConfirm={() => { setConfirmDel(false); onDelete() }}
        title="Supprimer cette promotion ?" description="Les remises appliquées seront retirées au prochain calcul." confirmLabel="Supprimer" cancelLabel="Annuler" variant="danger"/>
    </div>
  )
}

// ─── Promo form modal ─────────────────────────────────────────
function PromoModal({ existing, brands, products, onClose, onSaved }: {
  existing?: Promotion|null; brands: Brand[]; products: Product[]; onClose: ()=>void; onSaved: ()=>void
}) {
  const isEdit = !!existing
  const today  = new Date().toISOString().split('T')[0]
  const [name, setName]           = useState(existing?.name ?? '')
  const [description, setDesc]    = useState(existing?.description ?? '')
  const [discountPct, setDiscount] = useState(String(existing?.discount_pct ?? ''))
  const [startsAt, setStartsAt]   = useState(existing ? existing.starts_at.split('T')[0] : today)
  const [endsAt, setEndsAt]       = useState(existing ? existing.ends_at.split('T')[0] : (() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().split('T')[0] })())
  const [isAct, setIsAct]         = useState(existing?.is_active ?? true)
  const [scope, setScope] = useState<'all'|'brands'|'categories'|'products'>(
    existing?.product_ids?.length ? 'products' : existing?.category_names?.length ? 'categories' : existing?.brand_ids?.length ? 'brands' : 'all'
  )
  const [selBrands, setSelBrands]     = useState<string[]>(existing?.brand_ids ?? [])
  const [selCats, setSelCats]         = useState<string[]>(existing?.category_names ?? [])
  const [selProducts, setSelProducts] = useState<string[]>(existing?.product_ids ?? [])
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    return products.filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, 30)
  }, [products, productSearch])

  const availableCats = useMemo(() => {
    const s = new Set(products.map(p => (p as any).category).filter(Boolean) as string[])
    COMMON_CATEGORIES.forEach(c => s.add(c))
    return Array.from(s).sort()
  }, [products])

  const handleSave = async () => {
    const pct = Number(discountPct)
    if (!name.trim()) return setError('Nom obligatoire')
    if (!pct || pct <= 0 || pct > 100) return setError('Remise invalide (1-100 %)')
    if (!startsAt || !endsAt) return setError('Dates obligatoires')
    if (startsAt > endsAt) return setError('La date de fin doit être après le début')
    setSaving(true); setError('')
    try {
      const data = {
        name: name.trim(), description: description.trim() || null, discount_pct: pct,
        brand_ids:      scope === 'brands'     ? selBrands   : [],
        category_names: scope === 'categories' ? selCats     : [],
        product_ids:    scope === 'products'   ? selProducts : [],
        starts_at: new Date(startsAt + 'T00:00:00').toISOString(),
        ends_at:   new Date(endsAt   + 'T23:59:59').toISOString(),
        is_active: isAct,
      }
      if (isEdit && existing) await updatePromotion(existing.id, data)
      else                    await createPromotion(data)
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const PRESETS = [5,10,15,20,25,30,40,50]
  const DURATIONS = [{ l:'1 sem.', d:7 },{ l:'2 sem.', d:14 },{ l:'1 mois', d:30 },{ l:'3 mois', d:90 }]

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[90vh]" hideClose>
        <DialogTitle className="sr-only">{isEdit ? 'Modifier' : 'Nouvelle'} promotion</DialogTitle>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Tag size={18} className="text-indigo-600"/></div>
            <div><p className="text-base font-black text-gray-900">{isEdit ? 'Modifier la promotion' : 'Nouvelle promotion'}</p><p className="text-xs text-gray-400">Remise par période, marque ou catégorie</p></div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Name */}
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input className="mt-1" placeholder="Ex: Soldes d'été, Black Friday…" value={name} onChange={e => setName(e.target.value)} autoFocus/></div>
            <div><Label>Description interne (optionnel)</Label><Input className="mt-1" placeholder="Note pour l'équipe…" value={description} onChange={e => setDesc(e.target.value)}/></div>
          </div>
          <Separator/>

          {/* Discount */}
          <div className="space-y-2">
            <Label>Remise *</Label>
            <div className="relative"><Input type="number" min="1" max="100" step="0.5" placeholder="20" value={discountPct} onChange={e => setDiscount(e.target.value)} className="pr-10 text-3xl font-black h-14"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">%</span></div>
            <div className="flex flex-wrap gap-1.5">{PRESETS.map(p => <button key={p} onClick={() => setDiscount(String(p))} className={cn('px-3 py-1.5 rounded-xl text-sm font-bold border transition-all', Number(discountPct)===p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>-{p}%</button>)}</div>
          </div>
          <Separator/>

          {/* Period */}
          <div className="space-y-3">
            <Label>Période *</Label>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500 mb-1">Du</p><DatePicker value={startsAt} onChange={setStartsAt} placeholder="Date de début"/></div>
              <div><p className="text-xs text-gray-500 mb-1">Au</p><DatePicker value={endsAt} onChange={setEndsAt} min={startsAt} placeholder="Date de fin"/></div>
            </div>
            <div className="flex gap-2 flex-wrap">{DURATIONS.map(s => <button key={s.d} onClick={() => { const d = new Date(startsAt || today); d.setDate(d.getDate()+s.d); setEndsAt(d.toISOString().split('T')[0]) }} className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-xl hover:border-gray-400 bg-white text-gray-600">{s.l}</button>)}</div>
          </div>
          <Separator/>

          {/* Scope */}
          <div className="space-y-3">
            <Label>Produits concernés</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id:'all',        label:'🌍 Tous les produits',    desc:'Toute la boutique' },
                { id:'brands',     label:'🏷 Par marque',           desc:'Sélectionner des marques' },
                { id:'categories', label:'📦 Par catégorie',        desc:'Sélectionner des catégories' },
                { id:'products',   label:'🔍 Produits spécifiques', desc:'Choisir article par article' },
              ].map(s => (
                <button key={s.id} onClick={() => setScope(s.id as any)} className={cn('text-left px-4 py-3 rounded-xl border-2 transition-all', scope===s.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white hover:border-gray-300')}>
                  <p className="text-sm font-bold">{s.label}</p>
                  <p className={cn('text-xs mt-0.5', scope===s.id ? 'text-gray-300' : 'text-gray-400')}>{s.desc}</p>
                </button>
              ))}
            </div>

            {scope === 'brands' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Sélectionnez les marques</p>
                <div className="flex flex-wrap gap-2">{brands.map(b => <button key={b.id} onClick={() => setSelBrands(p => p.includes(b.id) ? p.filter(x=>x!==b.id) : [...p,b.id])} className={cn('px-3 py-1.5 rounded-xl text-sm font-medium border transition-all', selBrands.includes(b.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>{b.name}</button>)}</div>
                {selBrands.length === 0 && <p className="text-xs text-amber-600">⚠ Sélectionnez au moins une marque</p>}
              </div>
            )}

            {scope === 'categories' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Sélectionnez les catégories</p>
                <div className="flex flex-wrap gap-2">{availableCats.map(cat => <button key={cat} onClick={() => setSelCats(p => p.includes(cat) ? p.filter(x=>x!==cat) : [...p,cat])} className={cn('px-3 py-1.5 rounded-xl text-sm font-medium border transition-all', selCats.includes(cat) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>{cat}</button>)}</div>
                {selCats.length === 0 && <p className="text-xs text-amber-600">⚠ Sélectionnez au moins une catégorie</p>}
              </div>
            )}

            {scope === 'products' && (
              <div className="space-y-2">
                <Input placeholder="Rechercher un produit…" value={productSearch} onChange={e => setProductSearch(e.target.value)}/>
                <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {filteredProducts.map(p => (
                    <button key={p.id} onClick={() => setSelProducts(prev => prev.includes(p.id) ? prev.filter(x=>x!==p.id) : [...prev,p.id])} className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors', selProducts.includes(p.id) ? 'bg-indigo-50' : 'hover:bg-gray-50')}>
                      <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', selProducts.includes(p.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300')}>{selProducts.includes(p.id) && <CheckCircle size={10} className="text-white"/>}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{p.name}</p><p className="text-xs text-gray-400">{(p as any).brand?.name} · {p.price.toFixed(2)} €</p></div>
                    </button>
                  ))}
                </div>
                {selProducts.length > 0 && <p className="text-xs text-indigo-600 font-semibold">{selProducts.length} produit{selProducts.length>1?'s':''} sélectionné{selProducts.length>1?'s':''}</p>}
              </div>
            )}
          </div>
          <Separator/>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <div><p className="text-sm font-semibold text-gray-900">Activer immédiatement</p><p className="text-xs text-gray-400">S'applique dès la date de début</p></div>
            <button onClick={() => setIsAct(!isAct)} className={cn('w-11 h-6 rounded-full transition-all relative', isAct ? 'bg-gray-900' : 'bg-gray-200')}>
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', isAct ? 'left-[22px]' : 'left-0.5')}/>
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !name || !discountPct} className="flex-1 gap-2">
            {saving ? <Spinner size="sm"/> : <><Tag size={14}/> {isEdit ? 'Enregistrer' : 'Créer'}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function PromotionsPage() {
  const [promos, setPromos]     = useState<Promotion[]>([])
  const [brands, setBrands]     = useState<Brand[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ applied: number; cleared: number } | null>(null)
  const [showNew, setShowNew]   = useState(false)
  const [editing, setEditing]   = useState<Promotion | null>(null)
  const [filter, setFilter]     = useState<'all'|'active'|'planned'|'ended'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b, pr] = await Promise.all([getPromotions(), getBrands(), getProducts()])
      setPromos((p as Promotion[]) || [])
      setBrands((b as Brand[]) || [])
      setProducts((pr as Product[]) || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleApply = async () => {
    setApplying(true); setApplyResult(null)
    try { setApplyResult(await applyActivePromotions() as any) }
    finally { setApplying(false) }
  }

  const filtered = useMemo(() => {
    if (filter === 'all')     return promos
    if (filter === 'active')  return promos.filter(p => isActive(p))
    if (filter === 'planned') return promos.filter(p => promoStatus(p).label === 'Planifiée')
    return promos.filter(p => ['Terminée','Désactivée'].includes(promoStatus(p).label))
  }, [promos, filter])

  const activeCount  = promos.filter(p => isActive(p)).length
  const plannedCount = promos.filter(p => promoStatus(p).label === 'Planifiée').length

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className=" mx-auto px-6 py-8 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div><h1 className="text-2xl font-bold text-gray-900">Promotions & Soldes</h1><p className="text-gray-500 text-sm mt-0.5">Remises par période, marque ou catégorie</p></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleApply} disabled={applying} className="gap-2">{applying ? <Spinner size="sm"/> : <><Zap size={14}/> Appliquer</>}</Button>
              <Button onClick={() => setShowNew(true)} className="gap-2"><Plus size={15}/> Nouvelle promo</Button>
            </div>
          </div>

          {applyResult && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div><p className="text-sm font-bold text-indigo-900">Promotions appliquées</p><p className="text-xs text-indigo-600 mt-0.5">{applyResult.applied} produit{applyResult.applied>1?'s':''} mis en promo{applyResult.cleared>0?` · ${applyResult.cleared} remise${applyResult.cleared>1?'s':''} retirée${applyResult.cleared>1?'s':''} `:''}</p></div>
              <button onClick={() => setApplyResult(null)} className="text-indigo-400 hover:text-indigo-700"><X size={14}/></button>
            </div>
          )}

          {promos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><p className="text-2xl font-black text-green-600">{activeCount}</p><p className="text-xs text-gray-400 mt-0.5">En cours</p></div>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><p className="text-2xl font-black text-purple-600">{plannedCount}</p><p className="text-xs text-gray-400 mt-0.5">Planifiées</p></div>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm"><p className="text-2xl font-black text-gray-900">{promos.length}</p><p className="text-xs text-gray-400 mt-0.5">Total</p></div>
            </div>
          )}

          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit flex-wrap">
            {[{id:'all',l:'Toutes'},{id:'active',l:'🟢 En cours'},{id:'planned',l:'📅 Planifiées'},{id:'ended',l:'✓ Terminées'}].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as any)} className={cn('px-4 py-2 rounded-xl text-sm font-semibold transition-all', filter===f.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700')}>{f.l}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg"/></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <Tag size={40} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm font-semibold text-gray-700">{filter==='all' ? 'Aucune promotion créée' : 'Aucune promotion ici'}</p>
              {filter==='all' && <p className="text-xs text-gray-400 mt-1">Créez votre première promotion pour booster vos ventes</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <PromoCard key={p.id} promo={p} brands={brands}
                  onEdit={() => setEditing(p)}
                  onToggle={async () => { await updatePromotion(p.id, { is_active: !p.is_active }); load() }}
                  onDelete={async () => { await deletePromotion(p.id); load() }}
                  onApply={handleApply}
                />
              ))}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 space-y-2">
            <p className="text-sm font-bold text-blue-900">💡 Comment ça marche ?</p>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Les promotions mettent à jour le champ <strong>"remise"</strong> sur les produits concernés dans votre catalogue.</p>
              <p>• La remise s'applique <strong>automatiquement au POS</strong> lors de l'ajout au panier.</p>
              <p>• Cliquez sur <strong>"Appliquer"</strong> pour forcer l'actualisation immédiate.</p>
              <p>• Si plusieurs promotions ciblent le même produit, <strong>la remise la plus élevée</strong> est appliquée.</p>
            </div>
          </div>
        </div>
      </div>

      {(showNew || editing) && (
        <PromoModal existing={editing} brands={brands} products={products}
          onClose={() => { setShowNew(false); setEditing(null) }} onSaved={load}/>
      )}
    </TooltipProvider>
  )
}
