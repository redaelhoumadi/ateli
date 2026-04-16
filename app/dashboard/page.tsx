'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, ShoppingCart, Package, Users, Calendar, ChevronDown, ChevronUp, X } from 'lucide-react'
import { getSalesStats, getBrands } from '@/lib/supabase'
import { getTierForSpend, REWARDS_TIERS } from '@/lib/customerPortal'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  StatCard, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody,
  Separator, ScrollArea, Spinner, EmptyState,
  TooltipProvider, cn,
} from '@/components/ui'

type SaleItem = { quantity:number; unit_price:number; total_price:number; product?:{name:string;brand?:{name:string}} }
type Sale = { id:string; total:number; total_items:number; payment_method:string; created_at:string; note?:string|null; customer?:{name:string}|null; seller?:{name:string}|null; items?:SaleItem[] }
type Brand = { id:string; name:string }

const fmt      = (n:number) => n.toFixed(2)+' €'
const fmtShort = (n:number) => n>=1000?(n/1000).toFixed(1)+'k €':n.toFixed(0)+' €'
const PAY: Record<string,string> = { card:'💳 Carte', cash:'💵 Espèces', mixed:'🔀 Mixte' }
const TIER_ICONS: Record<string,string> = { bronze:'🥉', silver:'🥈', gold:'🥇', vip:'💜' }
const BRAND_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']

function Sparkline({ values, color='#000' }: { values:number[]; color?:string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1), w=80, h=28
  const pts = values.map((v,i) => `${(i/(values.length-1))*w},${h-(v/max)*h}`).join(' ')
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>
}

function HBar({ label, value, max, color }: { label:string; value:number; max:number; color:string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${max>0?(value/max)*100:0}%`,background:color}}/>
      </div>
      <span className="text-xs font-bold text-gray-700 w-16 text-right shrink-0">{fmtShort(value)}</span>
    </div>
  )
}

function SaleModal({ sale, onClose }: { sale:Sale; onClose:()=>void }) {
  const date = new Date(sale.created_at)
  const brandBreakdown = useMemo(() => {
    const map = new Map<string,number>()
    ;(sale.items||[]).forEach(i => { const b = i.product?.brand?.name||'Autre'; map.set(b,(map.get(b)||0)+i.total_price) })
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1])
  }, [sale])

  return (
    <Dialog open onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">Détail de la vente du {date.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</DialogTitle>
        <div className="bg-gray-900 px-6 py-4 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-base">{date.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
              <p className="text-gray-400 text-xs mt-0.5">{date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · {PAY[sale.payment_method]||sale.payment_method}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors rounded-lg p-1.5 hover:bg-white/10"><X size={16}/></button>
          </div>
          <p className="text-3xl font-black text-white mt-3">{fmt(sale.total)}</p>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-4">
            {sale.customer && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-sm text-gray-700">{sale.customer.name[0]}</div>
                <div><p className="text-sm font-semibold text-gray-900">{sale.customer.name}</p><p className="text-xs text-gray-500">Client fidélité</p></div>
              </div>
            )}
            {sale.seller && <p className="text-xs text-gray-400">Vendeur : <span className="font-semibold text-gray-700">{sale.seller.name}</span></p>}
            {sale.note && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="text-amber-500 shrink-0 mt-0.5">📝</span>
                <div>
                  <p className="text-xs font-bold text-amber-800 mb-0.5">Note</p>
                  <p className="text-sm text-amber-900">{sale.note}</p>
                </div>
              </div>
            )}
            {sale.items && sale.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Articles ({sale.total_items})</p>
                <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                  {sale.items.map((item,i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.product?.name||'—'}</p>
                        <p className="text-xs text-gray-400">{item.product?.brand?.name} · {item.unit_price.toFixed(2)} € ×{item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{item.total_price.toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {brandBreakdown.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Par marque</p>
                {brandBreakdown.map(([brand,rev],i) => (
                  <HBar key={brand} label={brand} value={rev} max={brandBreakdown[0][1]} color={BRAND_COLORS[i%BRAND_COLORS.length]}/>
                ))}
              </div>
            )}
            <Separator/>
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-gray-900">Total encaissé</span>
              <span className="text-xl font-black text-gray-900">{fmt(sale.total)}</span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default function DashboardPage() {
  const [sales, setSales]       = useState<Sale[]>([])
  const [brands, setBrands]     = useState<Brand[]>([])
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState<'today'|'week'|'month'|'all'|'custom'>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [filterBrand, setFilterBrand]   = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale|null>(null)

  useEffect(() => { getBrands().then(b => setBrands((b as Brand[])||[])) }, [])

  useEffect(() => {
    const now = new Date()
    let dateFrom: string|undefined, dateTo: string|undefined
    if (period==='today') dateFrom = new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString()
    else if (period==='week') { const d=new Date(now); d.setDate(d.getDate()-7); dateFrom=d.toISOString() }
    else if (period==='month') { const d=new Date(now); d.setMonth(d.getMonth()-1); dateFrom=d.toISOString() }
    else if (period==='custom') {
      if (customFrom) dateFrom = new Date(customFrom+'T00:00:00').toISOString()
      if (customTo)   dateTo   = new Date(customTo+'T23:59:59').toISOString()
      if (!customFrom && !customTo) return
    }
    setLoading(true)
    getSalesStats(dateFrom, dateTo).then(d => setSales((d as unknown as Sale[])||[])).finally(()=>setLoading(false))
  }, [period, customFrom, customTo])

  const filtered = useMemo(() => sales.filter(s => {
    const mp = !filterPayment || s.payment_method===filterPayment
    const mb = !filterBrand  || (s.items||[]).some(i=>i.product?.brand?.name===filterBrand)
    return mp && mb
  }), [sales, filterBrand, filterPayment])

  const totalRevenue = filtered.reduce((s,v)=>s+v.total,0)
  const totalItems   = filtered.reduce((s,v)=>s+v.total_items,0)
  const avgTicket    = filtered.length ? totalRevenue/filtered.length : 0
  const withCustomer = filtered.filter(s=>s.customer).length
  const fidelityRate = filtered.length ? Math.round((withCustomer/filtered.length)*100) : 0

  const brandRevenue = useMemo(() => {
    const map = new Map<string,{revenue:number;qty:number;txCount:number}>()
    filtered.forEach(sale => {
      const bs = new Set<string>()
      ;(sale.items||[]).forEach(item => {
        const b=item.product?.brand?.name||'Autre'; bs.add(b)
        const cur=map.get(b)||{revenue:0,qty:0,txCount:0}
        cur.revenue+=item.total_price; cur.qty+=item.quantity; map.set(b,cur)
      })
      bs.forEach(b=>{const cur=map.get(b)!;cur.txCount++})
    })
    return Array.from(map.entries()).map(([name,d])=>({name,...d})).sort((a,b)=>b.revenue-a.revenue)
  }, [filtered])

  const paymentRevenue = useMemo(() => {
    const map = new Map<string,number>()
    filtered.forEach(s=>map.set(s.payment_method,(map.get(s.payment_method)||0)+s.total))
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1])
  }, [filtered])

  const hourlyRevenue = useMemo(() => {
    const map = new Map<number,number>()
    for(let h=9;h<21;h++) map.set(h,0)
    filtered.forEach(s=>{const h=new Date(s.created_at).getHours();map.set(h,(map.get(h)||0)+s.total)})
    return Array.from(map.entries()).sort((a,b)=>a[0]-b[0])
  }, [filtered])

  const loyaltyStats = useMemo(() => {
    const tiers = REWARDS_TIERS.map(t=>({...t,count:0,revenue:0}))
    filtered.forEach(s=>{
      if(s.customer){
        const t=getTierForSpend(0)
        tiers.find(t=>t.id==='bronze')!.revenue+=s.total
        tiers.find(t=>t.id==='bronze')!.count++
      }
    })
    return tiers
  }, [filtered])

  const maxHour = Math.max(...hourlyRevenue.map(([,v])=>v),1)

  const PERIOD_PRESETS = [
    ['today',"Aujourd'hui"],['week','7 jours'],['month','30 jours'],['all','Tout']
  ] as const

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {filtered.length} transaction{filtered.length>1?'s':''}
                {period==='custom'&&customFrom&&customTo&&(
                  <Badge variant="secondary" size="sm" className="ml-2">
                    {new Date(customFrom).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} → {new Date(customTo).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                  </Badge>
                )}
              </p>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Period presets */}
              <div className="flex flex-wrap bg-white border border-gray-200 rounded-xl p-1 gap-0.5">
                {PERIOD_PRESETS.map(([p,label]) => (
                  <button key={p} onClick={()=>{setPeriod(p as any)}}
                    className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all', period===p?'bg-gray-900 text-white shadow-sm':'text-gray-600 hover:bg-gray-50')}>
                    {label}
                  </button>
                ))}
                <button onClick={()=>setPeriod('custom')}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all', period==='custom'?'bg-gray-900 text-white shadow-sm':'text-gray-600 hover:bg-gray-50')}>
                  <Calendar size={13}/> Période
                </button>
              </div>

              {/* Custom date range */}
              {period==='custom' && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-gray-400 font-medium shrink-0">Du</span>
                  <input type="date" value={customFrom} max={customTo||undefined} onChange={e=>setCustomFrom(e.target.value)} className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"/>
                  <span className="text-xs text-gray-400 font-medium shrink-0">au</span>
                  <input type="date" value={customTo} min={customFrom||undefined} max={new Date().toISOString().split('T')[0]} onChange={e=>setCustomTo(e.target.value)} className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"/>
                  {(customFrom||customTo) && <button onClick={()=>{setCustomFrom('');setCustomTo('')}} className="text-gray-300 hover:text-gray-600 ml-1"><X size={14}/></button>}
                </div>
              )}

              {/* Brand filter */}
              <Select onValueChange={v => setFilterBrand(v === 'all' ? '' : v)} value={filterBrand || 'all'}>
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Toutes marques"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {brands.map(b=><SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Payment filter */}
              <Select onValueChange={v => setFilterPayment(v === 'all' ? '' : v)} value={filterPayment || 'all'}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Tous paiements"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous paiements</SelectItem>
                  <SelectItem value="card">💳 Carte</SelectItem>
                  <SelectItem value="cash">💵 Espèces</SelectItem>
                  <SelectItem value="mixed">🔀 Mixte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-24"><Spinner size="lg"/></div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
                {[
                  { label:"Chiffre d'affaires", value:fmt(totalRevenue),    sub:`${filtered.length} ventes`,      icon:<TrendingUp size={18}/> },
                  { label:'Ticket moyen',        value:fmt(avgTicket),       sub:`${totalItems} articles`,          icon:<ShoppingCart size={18}/> },
                  { label:'Articles vendus',     value:totalItems.toString(),sub:`${(totalItems/(filtered.length||1)).toFixed(1)} / vente`, icon:<Package size={18}/> },
                  { label:'Top marque',          value:brandRevenue[0]?fmtShort(brandRevenue[0].revenue):'—', sub:brandRevenue[0]?.name||'—', icon:<span>🏷</span> },
                  { label:'Taux fidélité',        value:`${fidelityRate} %`,  sub:`${withCustomer} avec compte`,    icon:<Users size={18}/> },
                ].map(k => <StatCard key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon}/>)}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview">
                <TabsList className="mb-6 overflow-x-auto flex-nowrap max-w-full">
                  <TabsTrigger value="overview">📊 Vue générale</TabsTrigger>
                  <TabsTrigger value="brands">🏷 Par marque</TabsTrigger>
                  <TabsTrigger value="sales">🧾 Ventes</TabsTrigger>
                  <TabsTrigger value="loyalty">🎁 Fidélité</TabsTrigger>
                </TabsList>

                {/* Overview */}
                <TabsContent value="overview">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Hourly chart */}
                    <Card>
                      <CardHeader><CardTitle>CA par heure</CardTitle></CardHeader>
                      <CardContent>
                        {filtered.length === 0 ? <EmptyState icon="📊" title="Pas de données"/> : (
                          <div className="flex items-end gap-1 h-36">
                            {hourlyRevenue.map(([h,v])=>(
                              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full rounded-t-md transition-all duration-500 min-h-[4px]"
                                  style={{height:`${Math.max(4,(v/maxHour)*120)}px`,background:v>0?'#6366f1':'#f3f4f6'}}/>
                                <span className="text-xs text-gray-400">{h}h</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Payment breakdown */}
                    <Card>
                      <CardHeader><CardTitle>Par mode de paiement</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {paymentRevenue.length === 0 ? <EmptyState icon="💳" title="Pas de données"/> : paymentRevenue.map(([method,rev])=>(
                          <div key={method} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-sm">{PAY[method]||method}</span>
                              <span className="text-xs text-gray-400">{filtered.filter(s=>s.payment_method===method).length} ventes</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">{fmt(rev)}</p>
                              <p className="text-xs text-gray-400">{totalRevenue>0?Math.round((rev/totalRevenue)*100):0}%</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Brands */}
                <TabsContent value="brands">
                  <Card>
                    <CardHeader><CardTitle>Chiffre d'affaires par marque</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {brandRevenue.length === 0 ? <EmptyState icon="🏷" title="Pas de données"/> : brandRevenue.map((b,i)=>(
                        <div key={b.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:BRAND_COLORS[i%BRAND_COLORS.length]}}/>
                              <span className="text-sm font-medium text-gray-900">{b.name}</span>
                              <Badge variant="secondary" size="sm">{b.qty} art.</Badge>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-gray-900">{fmt(b.revenue)}</span>
                              <span className="text-xs text-gray-400 ml-2">{totalRevenue>0?Math.round((b.revenue/totalRevenue)*100):0}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{width:`${brandRevenue[0]?.revenue>0?(b.revenue/brandRevenue[0].revenue)*100:0}%`,background:BRAND_COLORS[i%BRAND_COLORS.length]}}/>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Sales list */}
                <TabsContent value="sales">
                  <Card className="overflow-hidden">
                    {filtered.length === 0 ? (
                      <EmptyState icon={<ShoppingCart size={40} className="text-gray-200"/>} title="Aucune vente sur cette période"/>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Paiement</th>
                              <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Articles</th>
                              <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {[...filtered].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,100).map(s=>(
                              <tr key={s.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={()=>setSelectedSale(s)}>
                                <td className="px-6 py-3.5">
                                  <p className="text-sm font-medium text-gray-900">{new Date(s.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</p>
                                  <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
                                </td>
                                <td className="px-6 py-3.5">
                                  {s.customer ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">{s.customer.name[0]}</div>
                                      <span className="text-sm text-gray-700">{s.customer.name}</span>
                                    </div>
                                  ) : <span className="text-xs text-gray-400 italic">Anonyme</span>}
                                </td>
                                <td className="px-6 py-3.5"><Badge variant="secondary" size="sm">{PAY[s.payment_method]||s.payment_method}</Badge></td>
                                <td className="px-6 py-3.5 text-right text-sm text-gray-600">{s.total_items}</td>
                                <td className="px-6 py-3.5 text-right text-sm font-bold text-gray-900">{fmt(s.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </TabsContent>

                {/* Loyalty */}
                <TabsContent value="loyalty">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {REWARDS_TIERS.map(tier=>{
                      const tierSales = filtered.filter(s=>s.customer)
                      const rev = tierSales.reduce((s,v)=>s+v.total,0)
                      return (
                        <Card key={tier.id} className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{TIER_ICONS[tier.id]}</span>
                            {tier.discount>0 && <Badge variant="secondary">-{tier.discount}%</Badge>}
                          </div>
                          <p className="text-2xl font-black" style={{color:tier.color}}>{tierSales.length}</p>
                          <p className="text-sm font-semibold text-gray-700">{tier.label}</p>
                          <p className="text-xs text-gray-400 mt-1">{fmtShort(rev)} CA</p>
                        </Card>
                      )
                    })}
                  </div>
                  <Card className="mt-6">
                    <CardHeader><CardTitle>Ventes avec compte client</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-black text-gray-900">{fidelityRate}%</div>
                        <div>
                          <p className="text-sm text-gray-600">{withCustomer} ventes avec compte</p>
                          <p className="text-xs text-gray-400">{filtered.length-withCustomer} ventes anonymes</p>
                        </div>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden ml-4">
                          <div className="h-full bg-purple-500 rounded-full transition-all" style={{width:`${fidelityRate}%`}}/>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {selectedSale && <SaleModal sale={selectedSale} onClose={()=>setSelectedSale(null)}/>}
    </TooltipProvider>
  )
}
