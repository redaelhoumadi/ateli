'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { Download, ChevronUp, ChevronDown, Users, TrendingUp, Tag, ShoppingBag, X } from 'lucide-react'
import { getCustomersWithSpend } from '@/lib/customerPortal'
import { REWARDS_TIERS, getTierForSpend, getNextTier } from '@/lib/customerPortal'
import {
  Button, Badge, Card, Input, StatCard, EmptyState, Spinner,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody,
  Separator, ScrollArea, TooltipProvider, cn,
} from '@/components/ui'

type C = {
  id: string; name: string; email: string; phone: string; created_at: string
  totalSpend: number; tier: typeof REWARDS_TIERS[number]; nextTier: typeof REWARDS_TIERS[number] | null
}
const TIER_ICONS: Record<string, string> = { bronze:'🥉', silver:'🥈', gold:'🥇', vip:'💜' }

export default function ClientsPage() {
  const [customers, setCustomers] = useState<C[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [sortCol, setSortCol]     = useState<'name'|'spend'|'date'>('spend')
  const [sortDir, setSortDir]     = useState<'asc'|'desc'>('desc')
  const [selected, setSelected]   = useState<C|null>(null)

  useEffect(() => {
    getCustomersWithSpend().then(d => setCustomers(d as C[])).finally(() => setLoading(false))
  }, [])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
      return ms && (!filterTier || c.tier.id === filterTier)
    })
    return [...list].sort((a,b) => {
      let d = 0
      if (sortCol==='name') d = a.name.localeCompare(b.name)
      if (sortCol==='spend') d = a.totalSpend - b.totalSpend
      if (sortCol==='date') d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir==='asc' ? d : -d
    })
  }, [customers, search, filterTier, sortCol, sortDir])

  const totalSpend  = customers.reduce((s,c) => s+c.totalSpend, 0)
  const withDisc    = customers.filter(c => c.tier.discount > 0).length
  const byTier      = REWARDS_TIERS.map(t => ({ ...t, count: customers.filter(c => c.tier.id === t.id).length }))

  const exportCSV = () => {
    const rows = [['Nom','Email','Téléphone','Palier','Remise','CA cumulé','Depuis'], ...filtered.map(c => [c.name,c.email,c.phone||'',c.tier.label,`${c.tier.discount}%`,c.totalSpend.toFixed(2),new Date(c.created_at).toLocaleDateString('fr-FR')])]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')], {type:'text/csv'}))
    a.download = `clients-ateli-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const SortBtn = ({ col, label }: { col: typeof sortCol; label: string }) => (
    <button onClick={() => toggleSort(col)} className={cn('flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors', sortCol===col?'text-gray-900':'text-gray-400 hover:text-gray-600')}>
      {label}
      {sortCol===col ? (sortDir==='asc'?<ChevronUp size={12}/>:<ChevronDown size={12}/>) : <ChevronDown size={12} className="opacity-30"/>}
    </button>
  )

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
              <p className="text-gray-500 text-sm mt-0.5">Programme de fidélité · {customers.length} membres</p>
            </div>
            <Button variant="outline" onClick={exportCSV} className="gap-1.5 px-2.5 sm:px-4"><Download size={14}/><span className="hidden sm:inline">Exporter CSV</span></Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <StatCard label="Total membres"  value={customers.length}                           icon={<Users size={18}/>}/>
            <StatCard label="CA cumulé"       value={`${totalSpend.toFixed(0)} €`}              icon={<TrendingUp size={18}/>}/>
            <StatCard label="Avec remise"     value={withDisc}                                  icon={<Tag size={18}/>}/>
            <StatCard label="Panier moyen"    value={customers.length ? `${(totalSpend/customers.length).toFixed(0)} €` : '—'} icon={<ShoppingBag size={18}/>}/>
          </div>

          {/* Tier filter cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {byTier.map(t => (
              <button key={t.id} onClick={() => setFilterTier(filterTier===t.id?'':t.id)}
                className={cn('rounded-2xl p-4 border-2 text-left transition-all hover:scale-[1.02]', filterTier===t.id ? 'shadow-md scale-[1.02]' : 'border-transparent')}
                style={{ background: t.bg, borderColor: filterTier===t.id ? t.color : 'transparent' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{TIER_ICONS[t.id]}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background:`${t.color}22`, color: t.color }}>
                    {t.discount>0?`-${t.discount}%`:'—'}
                  </span>
                </div>
                <p className="text-xl font-black" style={{color:t.color}}>{t.count}</p>
                <p className="text-xs font-semibold" style={{color:t.color}}>{t.label}</p>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex gap-3">
            <Input placeholder="Nom, email ou téléphone…" value={search} onChange={e=>setSearch(e.target.value)} className="flex-1"/>
            {filterTier && <Button variant="outline" onClick={()=>setFilterTier('')}><X size={14}/> Filtre {REWARDS_TIERS.find(t=>t.id===filterTier)?.label}</Button>}
          </div>

          {/* Table */}
          <Card className="overflow-hidden"><div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3.5"><SortBtn col="name" label="Client"/></th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
                  <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Palier</th>
                  <th className="text-right px-6 py-3.5"><SortBtn col="spend" label="CA cumulé"/></th>
                  <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Remise</th>
                  <th className="text-right px-6 py-3.5"><SortBtn col="date" label="Membre depuis"/></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center"><Spinner size="md" className="mx-auto"/></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState icon={<Users size={36} className="text-gray-200"/>} title="Aucun client trouvé"/></td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={()=>setSelected(c)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0" style={{background:c.tier.color}}>{c.name[0]?.toUpperCase()}</div>
                        <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{c.email}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border" style={{background:c.tier.bg,color:c.tier.color,borderColor:`${c.tier.color}33`}}>
                        {TIER_ICONS[c.tier.id]} {c.tier.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-gray-900">{c.totalSpend.toFixed(0)} €</p>
                      {c.nextTier && (
                        <div className="mt-1 w-20 ml-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${Math.min(100,((c.totalSpend-c.tier.minSpend)/(c.nextTier.minSpend-c.tier.minSpend))*100)}%`,background:c.nextTier.color}}/>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {c.tier.discount>0 ? <span className="text-sm font-black" style={{color:c.tier.color}}>-{c.tier.discount}%</span> : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>{/* overflow-x-auto */}
            {!loading && filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50">
                <p className="text-xs text-gray-400">{filtered.length} client{filtered.length>1?'s':''}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <div className="px-6 py-5 flex items-start justify-between" style={{background:selected.tier.bg}}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl text-white font-black" style={{background:selected.tier.color}}>{selected.name[0]}</div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">{selected.name}</h3>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border mt-1 bg-white" style={{color:selected.tier.color,borderColor:`${selected.tier.color}33`}}>
                    {TIER_ICONS[selected.tier.id]} {selected.tier.label}{selected.tier.discount>0&&` · -${selected.tier.discount}%`}
                  </span>
                </div>
              </div>
              <button onClick={()=>setSelected(null)} className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-white/50 transition-colors"><X size={16}/></button>
            </div>
            <ScrollArea className="max-h-[60vh]">
              <div className="p-6 space-y-5">
                {selected.tier.discount>0 ? (
                  <div className="rounded-2xl p-4 text-center" style={{background:selected.tier.bg,border:`1px solid ${selected.tier.color}33`}}>
                    <p className="text-5xl font-black" style={{color:selected.tier.color}}>-{selected.tier.discount}%</p>
                    <p className="text-xs mt-1 opacity-60" style={{color:selected.tier.color}}>remise automatique en caisse</p>
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 text-center bg-gray-50 border border-gray-100">
                    <p className="text-sm text-gray-500">Encore <strong>{(150-selected.totalSpend).toFixed(0)} €</strong> pour -5%</p>
                  </div>
                )}
                {selected.nextTier && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Vers {selected.nextTier.label}</span>
                      <span className="font-bold" style={{color:selected.nextTier.color}}>{selected.totalSpend.toFixed(0)} / {selected.nextTier.minSpend} €</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width:`${Math.min(100,((selected.totalSpend-selected.tier.minSpend)/(selected.nextTier.minSpend-selected.tier.minSpend))*100)}%`,background:`linear-gradient(90deg,${selected.tier.color},${selected.nextTier.color})`}}/>
                    </div>
                    <p className="text-xs text-center font-semibold" style={{color:selected.nextTier.color}}>Il manque {(selected.nextTier.minSpend-selected.totalSpend).toFixed(0)} € pour -{selected.nextTier.discount}%</p>
                  </div>
                )}
                <Separator/>
                <div className="space-y-2">
                  {[['Email',selected.email],['Téléphone',selected.phone||'—'],['CA cumulé',`${selected.totalSpend.toFixed(2)} €`],['Code client',selected.id.slice(0,8).toUpperCase()],['Membre depuis',new Date(selected.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})]].map(([l,v])=>(
                    <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-500">{l}</span>
                      <span className="text-sm font-semibold text-gray-900 font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        )}
      </Dialog>
    </TooltipProvider>
  )
}
