'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import {
  Download, ChevronUp, ChevronDown, Users, TrendingUp, Tag, ShoppingBag,
  X, Save, Phone, Mail, MapPin, Instagram, StickyNote, Cake, ShoppingCart, Edit2,
} from 'lucide-react'
import { getCustomersWithSpend } from '@/lib/customerPortal'
import { REWARDS_TIERS } from '@/lib/customerPortal'
import { getCustomerSales, updateCustomerProfile } from '@/lib/supabase'
import {
  Button, Card, Input, Label, StatCard, EmptyState, Spinner,
  Dialog, DialogContent, DialogTitle, Separator, TooltipProvider, cn, DatePicker,
} from '@/components/ui'

type C = {
  id: string; name: string; email: string; phone: string; created_at: string
  notes: string | null; birthday: string | null; address: string | null
  instagram: string | null; tags: string[]
  totalSpend: number; tier: typeof REWARDS_TIERS[number]; nextTier: typeof REWARDS_TIERS[number] | null
}
const TIER_ICONS: Record<string,string> = { bronze:'🥉', silver:'🥈', gold:'🥇', vip:'💜' }
const TAGS = ['VIP','Pro','Créateur','Presse','Fidèle','Local','En ligne']
const fmtE = (n: number) => n.toFixed(2) + ' €'

function CustomerModal({ c: init, onClose, onSaved }: { c: C; onClose: ()=>void; onSaved: (u: Partial<C>)=>void }) {
  const [c, setC]       = useState(init)
  const [tab, setTab]   = useState<'info'|'achats'|'notes'>('info')
  const [editing, setEditing] = useState(false)
  const [sales, setSales]     = useState<any[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')
  const [form, setForm] = useState({
    name: init.name, email: init.email, phone: init.phone ?? '',
    address: init.address ?? '', instagram: init.instagram ?? '',
    birthday: init.birthday || '', notes: init.notes || '',
    tags: (init.tags ?? []) as string[],
  })
  const fv = (k: keyof typeof form) => form[k] as string
  const sv = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))
  const toggleTag = (t: string) => sv('tags', (form.tags as string[]).includes(t) ? (form.tags as string[]).filter(x => x !== t) : [...(form.tags as string[]), t])

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const u = await updateCustomerProfile(c.id, { name: form.name, email: form.email, phone: form.phone||undefined, address: form.address||null, instagram: form.instagram||null, birthday: form.birthday||null, notes: form.notes||null, tags: form.tags as string[] })
      const next = { ...c, ...(u as any) }
      setC(next); onSaved(next); setEditing(false)
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  useEffect(() => {
    if (tab === 'achats' && sales.length === 0) {
      setLoadingSales(true)
      getCustomerSales(c.id).then(d => setSales((d as any[]) || [])).finally(() => setLoadingSales(false))
    }
  }, [tab, c.id, sales.length])

  const { tier, nextTier, totalSpend } = c
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]" hideClose>
        <DialogTitle className="sr-only">Fiche {c.name}</DialogTitle>
        <div className="px-5 py-4 flex items-start justify-between shrink-0" style={{ background: tier.bg }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl text-white font-black shrink-0" style={{ background: tier.color }}>{c.name[0].toUpperCase()}</div>
            <div className="min-w-0">
              <p className="font-black text-gray-900 text-base truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border" style={{ color: tier.color, borderColor: `${tier.color}33` }}>{TIER_ICONS[tier.id]} {tier.label}{tier.discount > 0 && ` · -${tier.discount}%`}</span>
                {(c.tags ?? []).map(t => <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(!editing)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/60"><Edit2 size={14}/></button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/60"><X size={16}/></button>
          </div>
        </div>
        <div className="flex border-b border-gray-100 shrink-0 bg-white">
          {[{id:'info',l:'👤 Profil'},{id:'achats',l:'🛍 Achats'},{id:'notes',l:'📝 Notes'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={cn('flex-1 py-3 text-xs font-semibold border-b-2 transition-all', tab===t.id?'border-gray-900 text-gray-900':'border-transparent text-gray-400 hover:text-gray-700')}>{t.l}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {tab === 'info' && (
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">CA cumulé</p>
                  <p className="text-xl font-black text-gray-900">{fmtE(totalSpend)}</p>
                </div>
                {nextTier && <>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(100,((totalSpend-tier.minSpend)/(nextTier.minSpend-tier.minSpend))*100)}%`, background:`linear-gradient(90deg,${tier.color},${nextTier.color})` }}/>
                  </div>
                  <p className="text-xs text-center text-gray-500">Encore <strong style={{color:nextTier.color}}>{(nextTier.minSpend-totalSpend).toFixed(0)} €</strong> pour <strong>{nextTier.label}</strong> (-{nextTier.discount}%)</p>
                </>}
              </div>
              <Separator/>
              {editing ? (
                <div className="space-y-3">
                  {([
                    {icon:<Users size={13}/>, l:'Nom', k:'name', t:'text', ph:'Marie Dupont'},
                    {icon:<Mail size={13}/>, l:'Email', k:'email', t:'email', ph:'marie@email.fr'},
                    {icon:<Phone size={13}/>, l:'Téléphone', k:'phone', t:'tel', ph:'06 12 34 56 78'},
                    {icon:<MapPin size={13}/>, l:'Adresse', k:'address', t:'text', ph:'12 rue des Fleurs'},
                    {icon:<Instagram size={13}/>, l:'Instagram', k:'instagram', t:'text', ph:'@marie'},
                  ] as any[]).map(f => (
                    <div key={f.k} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-gray-500">{f.icon}</div>
                      <div className="flex-1"><Label className="text-xs">{f.l}</Label><Input type={f.t} value={fv(f.k)} placeholder={f.ph} onChange={e=>sv(f.k,e.target.value)} className="mt-0.5 h-8 text-sm"/></div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-gray-500"><Cake size={13}/></div>
                    <div className="flex-1">
                      <Label className="text-xs">Anniversaire</Label>
                      <DatePicker value={fv('birthday')} onChange={e => sv('birthday', e)}/>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {TAGS.map(t => <button key={t} onClick={()=>toggleTag(t)} className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all', (form.tags as string[]).includes(t)?'bg-gray-900 text-white':'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>{t}</button>)}
                    </div>
                  </div>
                  {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={()=>setEditing(false)} disabled={saving}>Annuler</Button>
                    <Button size="sm" onClick={save} disabled={saving} className="flex-1 gap-1.5">{saving?<Spinner size="sm"/>:<><Save size={13}/> Enregistrer</>}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    ['Email', c.email], ['Téléphone', c.phone||'—'], ['Adresse', c.address||'—'],
                    ['Instagram', c.instagram||'—'],
                    ['Anniversaire', c.birthday ? new Date(c.birthday).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : '—'],
                    ['Code client', c.id.replace(/-/g,'').slice(0,8).toUpperCase()],
                    ['Membre depuis', new Date(c.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})],
                  ].map(([l,v]) => (
                    <div key={l as string} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{l}</span>
                      <span className={cn('text-sm flex-1 text-right', v==='—'?'text-gray-300':'font-medium text-gray-900')}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'achats' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-black">{sales.length}</p><p className="text-xs text-gray-400">Achats</p></div>
                <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-black">{fmtE(totalSpend)}</p><p className="text-xs text-gray-400">Total</p></div>
                <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-black">{sales.length>0?fmtE(totalSpend/sales.length):'—'}</p><p className="text-xs text-gray-400">Moy.</p></div>
              </div>
              {loadingSales ? <div className="flex justify-center py-8"><Spinner size="md"/></div> :
               sales.length===0 ? <div className="text-center py-8"><ShoppingCart size={32} className="text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">Aucun achat</p></div> :
               <div className="space-y-2">{sales.map((s:any) => (
                <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-3.5">
                  <div className="flex justify-between mb-1.5">
                    <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short'})}</p>
                    <p className="text-sm font-black">{fmtE(s.total)}</p>
                  </div>
                  {(s.items||[]).slice(0,3).map((i:any,idx:number) => <p key={idx} className="text-xs text-gray-500 truncate">{i.product?.name} ×{i.quantity}</p>)}
                  {(s.items||[]).length>3 && <p className="text-xs text-gray-300">+{s.items.length-3} autres…</p>}
                </div>
               ))}</div>}
            </div>
          )}
          {tab === 'notes' && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Notes internes (non visibles par le client)</p>
              <textarea value={form.notes} onChange={e=>sv('notes',e.target.value)} rows={8}
                placeholder="Préférences, historique, remarques…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              {err && <p className="text-xs text-red-500">{err}</p>}
              <Button onClick={save} disabled={saving} className="w-full gap-2">{saving?<Spinner size="sm"/>:<><Save size={14}/> Enregistrer</>}</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function ClientsPage() {
  const [customers, setCustomers] = useState<C[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [sortCol, setSortCol]     = useState<'name'|'spend'|'date'>('spend')
  const [sortDir, setSortDir]     = useState<'asc'|'desc'>('desc')
  const [selected, setSelected]   = useState<C|null>(null)

  useEffect(() => { getCustomersWithSpend().then(d => setCustomers(d as C[])).finally(() => setLoading(false)) }, [])

  const toggleSort = (col: typeof sortCol) => { if (sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc'); else {setSortCol(col);setSortDir('desc')} }

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
      return ms && (!filterTier || c.tier.id===filterTier)
    })
    return [...list].sort((a,b) => {
      let d=0
      if (sortCol==='name') d=a.name.localeCompare(b.name)
      if (sortCol==='spend') d=a.totalSpend-b.totalSpend
      if (sortCol==='date') d=new Date(a.created_at).getTime()-new Date(b.created_at).getTime()
      return sortDir==='asc'?d:-d
    })
  }, [customers, search, filterTier, sortCol, sortDir])

  const totalSpend = customers.reduce((s,c)=>s+c.totalSpend,0)
  const withDisc   = customers.filter(c=>c.tier.discount>0).length
  const byTier     = REWARDS_TIERS.map(t=>({...t, count: customers.filter(c=>c.tier.id===t.id).length}))

  const exportCSV = () => {
    const rows=[['Nom','Email','Téléphone','Palier','Remise','CA','Tags','Depuis'],
      ...filtered.map(c=>[c.name,c.email,c.phone||'',c.tier.label,`${c.tier.discount}%`,c.totalSpend.toFixed(2),(c.tags||[]).join(';'),new Date(c.created_at).toLocaleDateString('fr-FR')])]
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')],{type:'text/csv'})); a.download=`clients-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const SortBtn=({col,label}:{col:typeof sortCol;label:string})=>(
    <button onClick={()=>toggleSort(col)} className={cn('flex items-center gap-1 text-xs font-semibold uppercase tracking-wide',sortCol===col?'text-gray-900':'text-gray-400 hover:text-gray-600')}>
      {label}{sortCol===col?(sortDir==='asc'?<ChevronUp size={12}/>:<ChevronDown size={12}/>):<ChevronDown size={12} className="opacity-30"/>}
    </button>
  )

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div><h1 className="text-2xl font-bold text-gray-900">Clients</h1><p className="text-gray-500 text-sm mt-0.5">{customers.length} membres</p></div>
            <Button variant="outline" onClick={exportCSV} className="gap-1.5"><Download size={14}/><span className="hidden sm:inline">Exporter CSV</span></Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <StatCard label="Total membres" value={customers.length} icon={<Users size={18}/>}/>
            <StatCard label="CA cumulé" value={`${totalSpend.toFixed(0)} €`} icon={<TrendingUp size={18}/>}/>
            <StatCard label="Avec remise" value={withDisc} icon={<Tag size={18}/>}/>
            <StatCard label="Panier moyen" value={customers.length?`${(totalSpend/customers.length).toFixed(0)} €`:'—'} icon={<ShoppingBag size={18}/>}/>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {byTier.map(t=>(
              <button key={t.id} onClick={()=>setFilterTier(filterTier===t.id?'':t.id)}
                className={cn('rounded-2xl p-4 border-2 text-left transition-all hover:scale-[1.02]',filterTier===t.id?'shadow-md scale-[1.02]':'border-transparent')}
                style={{background:t.bg,borderColor:filterTier===t.id?t.color:'transparent'}}>
                <div className="flex justify-between mb-2"><span className="text-2xl">{TIER_ICONS[t.id]}</span><span className="text-xs font-black px-2 py-0.5 rounded-full" style={{background:`${t.color}22`,color:t.color}}>{t.discount>0?`-${t.discount}%`:'—'}</span></div>
                <p className="text-xl font-black" style={{color:t.color}}>{t.count}</p><p className="text-xs font-semibold" style={{color:t.color}}>{t.label}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Input placeholder="Nom, email ou téléphone…" value={search} onChange={e=>setSearch(e.target.value)} className="flex-1"/>
            {filterTier && <Button variant="outline" onClick={()=>setFilterTier('')}><X size={14}/> {REWARDS_TIERS.find(t=>t.id===filterTier)?.label}</Button>}
          </div>
          <Card className="overflow-hidden"><div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3.5"><SortBtn col="name" label="Client"/></th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase">Contact</th>
                  <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase">Palier</th>
                  <th className="text-right px-6 py-3.5"><SortBtn col="spend" label="CA cumulé"/></th>
                  <th className="text-center px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase">Tags</th>
                  <th className="text-right px-6 py-3.5"><SortBtn col="date" label="Depuis"/></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading?<tr><td colSpan={6} className="py-16 text-center"><Spinner size="md" className="mx-auto"/></td></tr>:
                 filtered.length===0?<tr><td colSpan={6}><EmptyState icon={<Users size={36} className="text-gray-200"/>} title="Aucun client"/></td></tr>:
                 filtered.map(c=>(
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={()=>setSelected(c)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0" style={{background:c.tier.color}}>{c.name[0]?.toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                          {c.notes && <p className="text-xs text-amber-600 flex items-center gap-1"><StickyNote size={10}/> Note</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><p className="text-sm text-gray-600">{c.email}</p>{c.phone&&<p className="text-xs text-gray-400">{c.phone}</p>}</td>
                    <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border" style={{background:c.tier.bg,color:c.tier.color,borderColor:`${c.tier.color}33`}}>{TIER_ICONS[c.tier.id]} {c.tier.label}</span></td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-gray-900">{c.totalSpend.toFixed(0)} €</p>
                      {c.nextTier&&<div className="mt-1 w-20 ml-auto h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${Math.min(100,((c.totalSpend-c.tier.minSpend)/(c.nextTier.minSpend-c.tier.minSpend))*100)}%`,background:c.nextTier.color}}/></div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {(c.tags||[]).slice(0,2).map(t=><span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>)}
                        {(c.tags||[]).length>2&&<span className="text-[10px] text-gray-400">+{c.tags.length-2}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading&&filtered.length>0&&<div className="px-6 py-3 border-t border-gray-50"><p className="text-xs text-gray-400">{filtered.length} client{filtered.length>1?'s':''}</p></div>}
          </Card>
        </div>
      </div>
      {selected&&<CustomerModal c={selected} onClose={()=>setSelected(null)} onSaved={u=>{setCustomers(p=>p.map(c=>c.id===selected.id?{...c,...u}:c));setSelected(p=>p?{...p,...u}:null)}}/>}
    </TooltipProvider>
  )
}
