'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Percent, Save, TrendingUp, Wallet, RotateCcw,
  ChevronUp, ChevronDown, AlertCircle, CheckCircle, Info,
} from 'lucide-react'
import {
  getBrands, getBrandStats, updateBrandFull, getSettings,
} from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  StatCard, Separator, Spinner, TooltipProvider,
  Tooltip, TooltipTrigger, TooltipContent, cn,
} from '@/components/ui'
import type { Brand, BrandStats } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────
const fmt      = (n: number) => n.toFixed(2) + ' €'
const fmtShort = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(2) + ' €'

function RateBar({ boutique, color = '#6366f1' }: { boutique: number; color?: string }) {
  const creator = 100 - boutique
  return (
    <div className="relative h-5 w-full rounded-full overflow-hidden bg-gray-100 flex">
      <div className="h-full flex items-center justify-center text-white text-[10px] font-black transition-all duration-300"
        style={{ width: `${boutique}%`, background: color, minWidth: boutique > 5 ? undefined : 0 }}>
        {boutique >= 10 && `${boutique}%`}
      </div>
      <div className="h-full flex-1 flex items-center justify-center text-green-700 text-[10px] font-black"
        style={{ background: '#D1FAE5' }}>
        {creator >= 10 && `${creator}%`}
      </div>
    </div>
  )
}

// ─── Brand commission row ──────────────────────────────────────
function BrandRow({ brand, stats, defaultRate, onSave }: {
  brand: Brand
  stats: BrandStats | null
  defaultRate: number
  onSave: (id: string, rate: number) => Promise<void>
}) {
  const currentRate  = brand.commission_rate ?? defaultRate
  const [rate, setRate]     = useState(String(currentRate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const rateNum      = Math.min(100, Math.max(0, Number(rate) || 0))
  const isDirty      = rateNum !== currentRate
  const isDefault    = rateNum === defaultRate

  // Simulated impact on current stats
  const grossRevenue = stats?.gross_revenue ?? 0
  const simCommission = Math.round(grossRevenue * rateNum / 100 * 100) / 100
  const simCreator    = Math.round(grossRevenue * (1 - rateNum / 100) * 100) / 100

  const handleSave = async () => {
    if (rateNum < 0 || rateNum > 100) return setError('Entre 0 et 100')
    setSaving(true); setError('')
    try {
      await onSave(brand.id, rateNum)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleReset = () => {
    setRate(String(defaultRate))
  }

  return (
    <div className={cn(
      'border rounded-2xl overflow-hidden transition-all duration-200',
      isDirty ? 'border-indigo-200 shadow-md' : 'border-gray-100',
      brand.is_active === false && 'opacity-50'
    )}>
      {/* Top bar — dirty indicator */}
      {isDirty && (
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-purple-500"/>
      )}

      <div className="bg-white px-5 py-4">
        <div className="flex items-start gap-4">
          {/* Brand avatar */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-black shrink-0 shadow-sm"
            style={{ background: isDirty ? '#6366f1' : '#9CA3AF' }}>
            {brand.name[0].toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 text-base">{brand.name}</p>
                  {brand.contact_name && (
                    <p className="text-xs text-gray-400">{brand.contact_name}</p>
                  )}
                  {!isDefault && (
                    <Badge variant="info" size="sm">Taux personnalisé</Badge>
                  )}
                  {brand.is_active === false && (
                    <Badge variant="secondary" size="sm">Inactive</Badge>
                  )}
                </div>
                {grossRevenue > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">CA total : {fmtShort(grossRevenue)}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isDirty && !isDefault && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={handleReset}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                        <RotateCcw size={13}/>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Revenir au taux par défaut ({defaultRate}%)</TooltipContent>
                  </Tooltip>
                )}
                {isDirty && (
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    {saving ? <Spinner size="sm"/> :
                     saved   ? <><CheckCircle size={13}/> Enregistré</> :
                               <><Save size={13}/> Enregistrer</>}
                  </Button>
                )}
                {!isDirty && saved && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle size={12}/> Enregistré
                  </span>
                )}
              </div>
            </div>

            {/* Rate editor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Slider + input */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <button onClick={() => setRate(v => String(Math.max(0, (Number(v) || 0) - 5)))}
                      className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors font-bold text-base">−</button>
                    <div className="relative flex items-center">
                      <input
                        type="number" value={rate} min="0" max="100" step="0.5"
                        onChange={e => setRate(e.target.value)}
                        className="w-14 text-center text-base font-black text-gray-900 focus:outline-none py-2 bg-white"
                      />
                      <span className="text-gray-400 font-bold text-sm pr-2">%</span>
                    </div>
                    <button onClick={() => setRate(v => String(Math.min(100, (Number(v) || 0) + 5)))}
                      className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors font-bold text-base">+</button>
                  </div>

                  {/* Quick presets */}
                  <div className="flex gap-1.5 flex-wrap">
                    {[20, 25, 30, 35, 40].map(p => (
                      <button key={p} onClick={() => setRate(String(p))}
                        className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
                          rateNum === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300')}>
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider */}
                <input type="range" value={rateNum} min="0" max="60" step="1"
                  onChange={e => setRate(e.target.value)}
                  className="w-full accent-indigo-600 cursor-pointer"/>

                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>

              {/* Impact simulation */}
              <div className="space-y-2">
                <RateBar boutique={rateNum}/>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-indigo-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-indigo-500 font-medium mb-0.5">Boutique</p>
                    <p className="text-sm font-black text-indigo-700">{rateNum}%</p>
                    {grossRevenue > 0 && (
                      <p className="text-xs text-indigo-400 mt-0.5">{fmtShort(simCommission)}</p>
                    )}
                  </div>
                  <div className="bg-green-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-green-600 font-medium mb-0.5">Créateur</p>
                    <p className="text-sm font-black text-green-700">{100 - rateNum}%</p>
                    {grossRevenue > 0 && (
                      <p className="text-xs text-green-500 mt-0.5">{fmtShort(simCreator)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────
export default function CommissionsPage() {
  const [brands, setBrands]         = useState<Brand[]>([])
  const [stats, setStats]           = useState<BrandStats[]>([])
  const [settings, setSettings]     = useState<Record<string, string>>({})
  const [loading, setLoading]       = useState(true)
  const [defaultRate, setDefaultRate] = useState(30)
  const [newDefault, setNewDefault]   = useState('30')
  const [savingDefault, setSavingDefault] = useState(false)
  const [savedDefault, setSavedDefault]   = useState(false)
  const [sortCol, setSortCol]       = useState<'name' | 'rate' | 'revenue'>('revenue')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc')
  const [filterChanged, setFilterChanged] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, s, cfg] = await Promise.all([getBrands(), getBrandStats(), getSettings()])
      setBrands((b as Brand[]) || [])
      setStats((s as BrandStats[]) || [])
      setSettings(cfg || {})
      const def = Number(cfg?.commission_default || 30)
      setDefaultRate(def)
      setNewDefault(String(def))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const statsMap = useMemo(() => new Map(stats.map(s => [s.brand.id, s])), [stats])

  const activeBrands = brands.filter(b => b.is_active !== false)

  const sorted = useMemo(() => {
    let list = filterChanged
      ? activeBrands.filter(b => b.commission_rate !== null && b.commission_rate !== defaultRate)
      : activeBrands
    return [...list].sort((a, b) => {
      let d = 0
      if (sortCol === 'name')    d = a.name.localeCompare(b.name)
      if (sortCol === 'rate')    d = (a.commission_rate ?? defaultRate) - (b.commission_rate ?? defaultRate)
      if (sortCol === 'revenue') d = (statsMap.get(a.id)?.gross_revenue ?? 0) - (statsMap.get(b.id)?.gross_revenue ?? 0)
      return sortDir === 'asc' ? d : -d
    })
  }, [activeBrands, filterChanged, sortCol, sortDir, statsMap, defaultRate])

  const handleSaveBrand = async (id: string, rate: number) => {
    await updateBrandFull(id, { commission_rate: rate })
    setBrands(prev => prev.map(b => b.id === id ? { ...b, commission_rate: rate } : b))
  }

  const handleSaveDefault = async () => {
    const rate = Number(newDefault)
    if (isNaN(rate) || rate < 0 || rate > 100) return
    setSavingDefault(true)
    try {
      const { updateSettings } = await import('@/lib/supabase')
      await updateSettings({ commission_default: String(rate) })
      setDefaultRate(rate)
      setSavedDefault(true)
      setTimeout(() => setSavedDefault(false), 2500)
    } catch (e: any) { alert(e.message) }
    finally { setSavingDefault(false) }
  }

  const handleApplyDefaultToAll = async () => {
    if (!confirm(`Appliquer ${newDefault}% à toutes les marques ? Les taux personnalisés seront écrasés.`)) return
    setSavingDefault(true)
    try {
      await Promise.all(activeBrands.map(b => updateBrandFull(b.id, { commission_rate: Number(newDefault) })))
      setBrands(prev => prev.map(b => b.is_active !== false ? { ...b, commission_rate: Number(newDefault) } : b))
      setDefaultRate(Number(newDefault))
      const { updateSettings } = await import('@/lib/supabase')
      await updateSettings({ commission_default: newDefault })
    } catch (e: any) { alert(e.message) }
    finally { setSavingDefault(false) }
  }

  // Global stats
  const totalRevenue    = stats.reduce((s, b) => s + b.gross_revenue, 0)
  const totalCommission = stats.reduce((s, b) => s + b.commission_amount, 0)
  const totalCreator    = stats.reduce((s, b) => s + b.net_to_pay, 0)
  const avgRate         = activeBrands.length
    ? activeBrands.reduce((s, b) => s + (b.commission_rate ?? defaultRate), 0) / activeBrands.length
    : defaultRate
  const customCount     = activeBrands.filter(b => b.commission_rate !== null && b.commission_rate !== defaultRate).length

  const SortBtn = ({ col, label }: { col: typeof sortCol; label: string }) => (
    <button onClick={() => { sortCol === col ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortCol(col), setSortDir('desc')) }}
      className={cn('flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors px-3 py-1.5 rounded-lg border',
        sortCol === col ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
      {label}
      {sortCol === col ? (sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>) : null}
    </button>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commissions par marque</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Configurez le taux de commission de chaque créateur — les calculs de reversement se mettent à jour automatiquement.
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="CA total"       value={fmtShort(totalRevenue)}    icon={<TrendingUp size={16}/>}/>
            <StatCard label="Commission moy." value={`${avgRate.toFixed(1)} %`} icon={<Percent size={16}/>}/>
            <StatCard label="Boutique"        value={fmtShort(totalCommission)} icon={<TrendingUp size={16}/>}/>
            <StatCard label="Créateurs"       value={fmtShort(totalCreator)}    icon={<Wallet size={16}/>}/>
          </div>

          {/* Taux par défaut */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent size={16}/>
                Taux de commission par défaut
                <Tooltip>
                  <TooltipTrigger>
                    <Info size={14} className="text-gray-400"/>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Ce taux s'applique aux marques sans taux personnalisé. Il est utilisé aussi pour les nouvelles marques créées.
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
                      <button onClick={() => setNewDefault(v => String(Math.max(0, (Number(v) || 0) - 5)))}
                        className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 font-bold text-base border-r border-gray-200">−</button>
                      <div className="relative flex items-center">
                        <input type="number" value={newDefault} min="0" max="100" step="0.5"
                          onChange={e => setNewDefault(e.target.value)}
                          className="w-16 text-center text-xl font-black text-gray-900 focus:outline-none py-2.5"/>
                        <span className="text-gray-400 font-bold pr-3">%</span>
                      </div>
                      <button onClick={() => setNewDefault(v => String(Math.min(100, (Number(v) || 0) + 5)))}
                        className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 font-bold text-base border-l border-gray-200">+</button>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveDefault} disabled={savingDefault || Number(newDefault) === defaultRate}
                        size="sm" className="gap-1.5">
                        {savingDefault ? <Spinner size="sm"/> :
                         savedDefault  ? <><CheckCircle size={13}/> Enregistré</> :
                                         <><Save size={13}/> Enregistrer</>}
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={handleApplyDefaultToAll}
                            disabled={savingDefault}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50">
                            Appliquer à toutes
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Écraser tous les taux personnalisés avec ce taux</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Global split preview */}
                <div className="flex-1 min-w-48 space-y-2">
                  <RateBar boutique={Number(newDefault) || 0} color="#6366f1"/>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-indigo-600">{newDefault}% boutique</span>
                    <span className="text-green-600">{(100 - Number(newDefault || 0)).toFixed(0)}% créateur</span>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <Info size={14} className="text-blue-500 shrink-0 mt-0.5"/>
                <div className="text-xs text-blue-700 space-y-0.5">
                  <p><strong>{activeBrands.filter(b => b.commission_rate === null || b.commission_rate === defaultRate).length} marques</strong> utilisent ce taux par défaut.</p>
                  {customCount > 0 && (
                    <p><strong>{customCount} marque{customCount > 1 ? 's' : ''}</strong> ont un taux personnalisé différent.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Separator with summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {activeBrands.length} marque{activeBrands.length > 1 ? 's' : ''} active{activeBrands.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              {/* Filter */}
              <button onClick={() => setFilterChanged(!filterChanged)}
                className={cn('text-xs font-medium px-3 py-1.5 rounded-lg border transition-all',
                  filterChanged ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300')}>
                {filterChanged ? '✓ Taux personnalisés' : 'Taux personnalisés uniquement'}
              </button>
              <Separator orientation="vertical" className="h-5"/>
              {/* Sort */}
              <div className="flex gap-1.5">
                <SortBtn col="revenue" label="CA"/>
                <SortBtn col="rate"    label="Taux"/>
                <SortBtn col="name"    label="Nom"/>
              </div>
            </div>
          </div>

          {/* Brand list */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg"/></div>
          ) : sorted.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
              <Percent size={36} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm font-semibold text-gray-700">
                {filterChanged ? 'Aucune marque avec taux personnalisé' : 'Aucune marque active'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(brand => (
                <BrandRow
                  key={brand.id}
                  brand={brand}
                  stats={statsMap.get(brand.id) ?? null}
                  defaultRate={defaultRate}
                  onSave={handleSaveBrand}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-indigo-200"/>
              <span>Part boutique</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-200"/>
              <span>Part créateur (reversement)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-indigo-500"/>
              <span>Modifications non enregistrées</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
