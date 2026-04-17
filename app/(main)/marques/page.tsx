'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Tag, TrendingUp, Package, Users,
  ChevronRight, ExternalLink, Instagram, Globe,
  CheckCircle, AlertCircle,
} from 'lucide-react'
import { getBrands, getBrandStats, createBrand } from '@/lib/supabase'
import {
  Button, Badge, Card, Input, StatCard, Spinner, EmptyState,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Label, TooltipProvider, cn,
} from '@/components/ui'
import type { Brand, BrandStats } from '@/types'

const CATEGORIES = ['Mode','Bijoux','Cosmétiques','Accessoires','Maison','Art','Lifestyle','Autre']
const CAT_COLORS: Record<string, string> = {
  Mode: '#6366f1', Bijoux: '#f59e0b', Cosmétiques: '#ec4899',
  Accessoires: '#0ea5e9', Maison: '#10b981', Art: '#8b5cf6',
  Lifestyle: '#f97316', Autre: '#6b7280',
}

const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(0) + ' €'

export default function MarquesPage() {
  const router = useRouter()
  const [brands, setBrands]   = useState<Brand[]>([])
  const [stats, setStats]     = useState<BrandStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([getBrands(), getBrandStats()])
      .then(([b, s]) => {
        setBrands((b as Brand[]) || [])
        setStats((s as BrandStats[]) || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const statsMap = useMemo(() =>
    new Map(stats.map(s => [s.brand.id, s])), [stats])

  const filtered = useMemo(() => brands.filter(b => {
    const ms = !search || b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.contact_name?.toLowerCase().includes(search.toLowerCase())
    const mc = !filterCat || b.category === filterCat
    return ms && mc
  }), [brands, search, filterCat])

  const totalRevenue = stats.reduce((s, b) => s + b.gross_revenue, 0)
  const totalActive  = brands.filter(b => b.is_active !== false).length
  const withContact  = brands.filter(b => b.contact_email || b.contact_phone).length
  const withIban     = brands.filter(b => b.iban).length

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const b = await createBrand(newName.trim())
      setBrands(prev => [...prev, b as Brand].sort((a, z) => a.name.localeCompare(z.name)))
      setNewName(''); setShowAdd(false)
      router.push(`/marques/${(b as Brand).id}`)
    } catch (e: any) { alert(e.message) }
    finally { setCreating(false) }
  }

  const categories = [...new Set(brands.map(b => b.category).filter(Boolean))] as string[]

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marques</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {brands.length} créateur{brands.length > 1 ? 's' : ''} en boutique
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus size={14}/> Nouvelle marque
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Marques actives"  value={totalActive}       icon={<Tag size={16}/>}/>
            <StatCard label="CA total (global)" value={fmt(totalRevenue)} icon={<TrendingUp size={16}/>}/>
            <StatCard label="Avec contact"      value={withContact}       icon={<Users size={16}/>}/>
            <StatCard label="IBAN configuré"    value={withIban}          icon={<CheckCircle size={16}/>}/>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-48">
              <Input icon={<Search size={14}/>} placeholder="Rechercher une marque ou un créateur…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
                  className={cn('px-3.5 py-2 rounded-xl text-sm font-medium border transition-all',
                    filterCat === cat
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  )}
                  style={filterCat === cat ? { background: CAT_COLORS[cat] ?? '#6366f1' } : {}}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Brands grid */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg"/></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Tag size={40} className="text-gray-200"/>}
              title={search || filterCat ? 'Aucune marque trouvée' : 'Aucune marque'}
              description="Commencez par ajouter votre première marque"
              action={<Button onClick={() => setShowAdd(true)}><Plus size={14}/> Ajouter une marque</Button>}/>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(brand => {
                const s = statsMap.get(brand.id)
                const isActive = brand.is_active !== false
                const commRate = brand.commission_rate ?? 30
                const catColor = CAT_COLORS[brand.category ?? ''] ?? '#6366f1'

                return (
                  <button key={brand.id}
                    onClick={() => router.push(`/marques/${brand.id}`)}
                    className="text-left bg-white border border-gray-100 rounded-2xl hover:border-gray-300 hover:shadow-md transition-all overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">

                    {/* Color bar + logo */}
                    <div className="h-2 w-full" style={{ background: catColor }}/>
                    <div className="px-5 pt-4 pb-2">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Logo or initial */}
                          {brand.logo_url ? (
                            <img src={brand.logo_url} alt={brand.name}
                              className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0"/>
                          ) : (
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-black shrink-0"
                              style={{ background: catColor }}>
                              {brand.name[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{brand.name}</p>
                            {brand.contact_name && (
                              <p className="text-xs text-gray-400 truncate">{brand.contact_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && <Badge variant="secondary" size="sm">Inactif</Badge>}
                          {brand.category && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                              style={{ background: catColor }}>
                              {brand.category}
                            </span>
                          )}
                        </div>
                      </div>

                      {brand.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{brand.description}</p>
                      )}

                      {/* Stats */}
                      {s && s.gross_revenue > 0 ? (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                            <p className="text-xs text-gray-400 mb-0.5">CA</p>
                            <p className="text-sm font-black text-gray-900">{fmt(s.gross_revenue)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                            <p className="text-xs text-gray-400 mb-0.5">Ventes</p>
                            <p className="text-sm font-black text-gray-900">{s.sales_count}</p>
                          </div>
                          <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                            <p className="text-xs text-green-600 mb-0.5">Net</p>
                            <p className="text-sm font-black text-green-700">{fmt(s.net_to_pay)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3 text-center">
                          <p className="text-xs text-gray-400">Aucune vente enregistrée</p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {brand.website && (
                            <div className="text-gray-300"><Globe size={13}/></div>
                          )}
                          {brand.instagram && (
                            <div className="text-gray-300"><Instagram size={13}/></div>
                          )}
                          {!brand.iban && (
                            <div className="flex items-center gap-1 text-amber-500">
                              <AlertCircle size={12}/>
                              <span className="text-xs font-medium">IBAN manquant</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-700 transition-colors">
                          Voir la fiche <ChevronRight size={13}/>
                        </div>
                      </div>
                    </div>

                    {/* Commission footer */}
                    <div className="border-t border-gray-50 px-5 py-2.5 flex items-center justify-between bg-gray-50/50">
                      <span className="text-xs text-gray-400">Commission boutique</span>
                      <span className="text-xs font-bold" style={{ color: catColor }}>{commRate}%</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add brand modal */}
      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle marque</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <Label>Nom de la marque <span className="text-red-400">*</span></Label>
                <Input placeholder="ex. Hadda Studio" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus/>
              </div>
              <p className="text-xs text-gray-400">
                Vous pourrez compléter la fiche (logo, description, coordonnées…) après la création.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={creating}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Spinner size="sm"/> : 'Créer et ouvrir la fiche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
