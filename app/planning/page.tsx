'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Download, Calendar, Grid, BarChart2, AlertTriangle, Check } from 'lucide-react'
import { getBrands } from '@/lib/supabase'
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Spinner, cn } from '@/components/ui'

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const SHOP_OPEN = 10, SHOP_CLOSE = 20
const HOURS = Array.from({length:SHOP_CLOSE-SHOP_OPEN},(_,i)=>i+SHOP_OPEN)

const SLOTS = [
  { id:'morning',   label:'10h–14h', start:10, end:14, color:'#3B82F6', bg:'#EFF6FF' },
  { id:'afternoon', label:'14h–20h', start:14, end:20, color:'#10B981', bg:'#ECFDF5' },
  { id:'full',      label:'10h–20h', start:10, end:20, color:'#6366F1', bg:'#EEF2FF' },
  { id:'custom',    label:'Perso',   start:0,  end:0,  color:'#F59E0B', bg:'#FFFBEB' },
  { id:'off',       label:'Absent',  start:0,  end:0,  color:'#9CA3AF', bg:'#F9FAFB' },
]
type SlotId = 'morning'|'afternoon'|'full'|'custom'|'off'
type CreatorSlot = { slotId:SlotId; customStart?:number; customEnd?:number }
type PlanningData = Record<string, Record<number, Record<string, CreatorSlot>>>
type Creator = { id:string; name:string }

function getWeekKey(d:Date) { const x=new Date(d),day=x.getDay(); x.setDate(x.getDate()-day+(day===0?-6:1)); return x.toISOString().split('T')[0] }
function getMon(k:string) { return new Date(k+'T00:00:00') }
function addWeeks(k:string,n:number) { const d=getMon(k); d.setDate(d.getDate()+n*7); return getWeekKey(d) }
function fmtWeek(k:string) { const m=getMon(k),s=new Date(m); s.setDate(m.getDate()+5); return `${m.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} – ${s.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}` }
function getCov(slot:CreatorSlot):{start:number;end:number}|null {
  if(slot.slotId==='off') return null
  if(slot.slotId==='custom') return slot.customStart!=null&&slot.customEnd!=null&&slot.customEnd>slot.customStart?{start:slot.customStart,end:slot.customEnd}:null
  const def=SLOTS.find(t=>t.id===slot.slotId)!
  return {start:def.start,end:def.end}
}
function getGaps(daySlots:Record<string,CreatorSlot>) {
  const covered=new Set<number>()
  Object.values(daySlots).forEach(slot=>{const c=getCov(slot);if(c)for(let h=c.start;h<c.end;h++)covered.add(h)})
  const gaps:{start:number;end:number}[]=[]; let gs:number|null=null
  for(let h=SHOP_OPEN;h<SHOP_CLOSE;h++){if(!covered.has(h)){if(gs===null)gs=h}else{if(gs!==null){gaps.push({start:gs,end:h});gs=null}}}
  if(gs!==null)gaps.push({start:gs,end:SHOP_CLOSE})
  return gaps
}

function SlotPicker({value,onChange}:{value:CreatorSlot|undefined;onChange:(s:CreatorSlot)=>void}) {
  const [open,setOpen]=useState(false)
  const [showCustom,setShowCustom]=useState(false)
  const [cStart,setCStart]=useState(10)
  const [cEnd,setCEnd]=useState(14)
  const cur=value??{slotId:'off' as SlotId}
  const def=SLOTS.find(t=>t.id===cur.slotId)??SLOTS[4]
  const label=cur.slotId==='custom'&&cur.customStart!=null?`${cur.customStart}h–${cur.customEnd}h`:def.label

  return (
    <div className="relative">
      <button onClick={()=>{setOpen(!open);setShowCustom(false)}}
        className="w-full flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{background:cur.slotId==='off'?'#F9FAFB':`${def.color}18`,color:cur.slotId==='off'?'#9CA3AF':def.color,border:`1px solid ${cur.slotId==='off'?'#E5E7EB':`${def.color}30`}`}}>
        <span className="truncate">{label}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          {SLOTS.filter(t=>t.id!=='custom').map(t=>(
            <button key={t.id} onClick={()=>{onChange({slotId:t.id as SlotId});setOpen(false)}}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors">
              <div className="w-2 h-2 rounded-full shrink-0" style={{background:t.color}}/>
              <span style={{color:t.id===cur.slotId?t.color:'#374151'}}>{t.label}</span>
              {t.id===cur.slotId&&<Check size={11} className="ml-auto" style={{color:t.color}}/>}
            </button>
          ))}
          {!showCustom ? (
            <button onClick={()=>setShowCustom(true)}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100">
              <div className="w-2 h-2 rounded-full shrink-0" style={{background:'#F59E0B'}}/>
              <span style={{color:cur.slotId==='custom'?'#F59E0B':'#374151'}}>{cur.slotId==='custom'?label:'Horaire perso…'}</span>
            </button>
          ) : (
            <div className="border-t border-gray-100 p-3 space-y-2">
              <p className="text-xs font-bold text-gray-700">Horaire personnalisé</p>
              <div className="flex items-center gap-2">
                <select value={cStart} onChange={e=>setCStart(Number(e.target.value))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                  {Array.from({length:9},(_,i)=>i+10).map(h=><option key={h} value={h}>{h}h</option>)}
                </select>
                <span className="text-xs text-gray-400">→</span>
                <select value={cEnd} onChange={e=>setCEnd(Number(e.target.value))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                  {Array.from({length:10},(_,i)=>i+11).map(h=><option key={h} value={h} disabled={h<=cStart}>{h}h</option>)}
                </select>
              </div>
              <button onClick={()=>{if(cEnd>cStart){onChange({slotId:'custom',customStart:cStart,customEnd:cEnd});setOpen(false);setShowCustom(false)}}}
                className="w-full py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors">
                Valider
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanningPage() {
  const [creators,setCreators]=useState<Creator[]>([])
  const [weekKey,setWeekKey]=useState(getWeekKey(new Date()))
  const [planning,setPlanning]=useState<PlanningData>({})
  const [loading,setLoading]=useState(true)
  const [view,setView]=useState<'grid'|'coverage'>('grid')

  useEffect(()=>{getBrands().then(d=>setCreators((d||[]) as Creator[])).finally(()=>setLoading(false))},[])
  useEffect(()=>{try{const s=localStorage.getItem('ateli_planning');if(s)setPlanning(JSON.parse(s))}catch{}},[])

  const save=useCallback((next:PlanningData)=>{setPlanning(next);localStorage.setItem('ateli_planning',JSON.stringify(next))},[])
  const getSlot=(di:number,cId:string)=>planning[weekKey]?.[di]?.[cId]
  const setSlot=(di:number,cId:string,slot:CreatorSlot)=>{
    const next=structuredClone(planning)
    if(!next[weekKey])next[weekKey]={}
    if(!next[weekKey][di])next[weekKey][di]={}
    next[weekKey][di][cId]=slot; save(next)
  }

  const dayAnalysis=useMemo(()=>DAYS.map((_,di)=>{
    const ds=planning[weekKey]?.[di]??{}
    const gaps=getGaps(ds)
    return{daySlots:ds,gaps,covered:gaps.length===0}
  }),[planning,weekKey])

  const coveredCount=dayAnalysis.filter(d=>d.covered).length
  const totalGapHours=dayAnalysis.reduce((s,d)=>s+d.gaps.reduce((g,gap)=>g+(gap.end-gap.start),0),0)

  const exportTxt=()=>{
    let txt=`Planning Ateli — ${fmtWeek(weekKey)}\n${'='.repeat(50)}\n\n`
    DAYS.forEach((day,i)=>{
      txt+=`${day}\n`
      const ds=planning[weekKey]?.[i]??{}
      creators.forEach(c=>{const s=ds[c.id];const cov=s?getCov(s):null;txt+=`  ${c.name}: ${cov?`${cov.start}h–${cov.end}h`:'Absent'}\n`})
      const gaps=getGaps(ds);if(gaps.length>0)txt+=`  ⚠ Vide: ${gaps.map(g=>`${g.start}h-${g.end}h`).join(', ')}\n`
      txt+='\n'
    })
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download=`planning-${weekKey}.txt`;a.click()
  }

  const COLORS=['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
  const isToday=(di:number)=>{const m=getMon(weekKey),d=new Date(m);d.setDate(m.getDate()+di);return d.toDateString()===new Date().toDateString()}
  const dayDate=(di:number)=>{const m=getMon(weekKey),d=new Date(m);d.setDate(m.getDate()+di);return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}

  if(loading) return <div className="flex-1 flex items-center justify-center bg-gray-50"><Spinner size="lg"/></div>

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-full px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning boutique</h1>
            <p className="text-gray-500 text-sm">10h – 20h · Lundi au Samedi</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 self-start sm:self-auto">
              <button onClick={()=>setView('grid')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',view==='grid'?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50')}>
                <Grid size={14}/> Grille
              </button>
              <button onClick={()=>setView('coverage')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',view==='coverage'?'bg-gray-900 text-white':'text-gray-600 hover:bg-gray-50')}>
                <BarChart2 size={14}/> Couverture
              </button>
            </div>

            {/* Week nav */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" onClick={()=>setWeekKey(addWeeks(weekKey,-1))}><ChevronLeft size={16}/></Button>
              <div className="text-center min-w-[130px] sm:min-w-[200px]">
                <p className="text-sm font-bold text-gray-900">{fmtWeek(weekKey)}</p>
                {weekKey===getWeekKey(new Date())&&<p className="text-xs text-blue-500 font-medium">Semaine actuelle</p>}
              </div>
              <Button variant="outline" size="icon" onClick={()=>setWeekKey(addWeeks(weekKey,1))}><ChevronRight size={16}/></Button>
              <Button variant="outline" size="sm" onClick={()=>setWeekKey(getWeekKey(new Date()))}>Aujourd'hui</Button>
            </div>

            <Button variant="outline" size="sm" onClick={exportTxt}><Download size={14}/> Exporter</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {label:'Jours couverts',value:`${coveredCount}/6`,ok:coveredCount===6},
            {label:'Heures manquantes',value:`${totalGapHours}h`,ok:totalGapHours===0},
            {label:'Créateurs',value:creators.length,ok:true},
            {label:'Objectif semaine',value:'60h',ok:true},
          ].map(k=>(
            <Card key={k.label} className="p-5 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black',k.ok?'bg-green-100 text-green-600':'bg-red-100 text-red-600')}>
                {k.ok ? <Check size={18}/> : <AlertTriangle size={18}/>}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{k.label}</p>
                <p className="text-xl font-black text-gray-900">{k.value}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Grid view */}
        {view==='grid' && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" style={{minWidth:`${Math.max(800,creators.length*150+280)}px`}}>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide w-36 border-r border-gray-100">Jour</th>
                    {creators.map((c,i)=>(
                      <th key={c.id} className="px-3 py-4 border-r border-gray-100 last:border-r-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0" style={{background:COLORS[i%COLORS.length]}}>{c.name[0]}</div>
                          <span className="text-xs font-bold text-gray-700 truncate">{c.name}</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide w-48">Couverture</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day,di)=>{
                    const{daySlots,gaps,covered}=dayAnalysis[di]
                    const today=isToday(di)
                    const TOTAL=SHOP_CLOSE-SHOP_OPEN
                    return (
                      <tr key={day} className={cn('border-b border-gray-50 last:border-0',today&&'bg-blue-50/40')}>
                        <td className="px-5 py-4 border-r border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black',covered?'bg-green-500':gaps.length>0?'bg-red-500':'bg-gray-200')}>
                              {covered?<Check size={10}/>:gaps.length>0?'!':null}
                            </div>
                            <div>
                              <p className={cn('text-sm font-bold',today?'text-blue-600':'text-gray-800')}>{day}</p>
                              <p className="text-xs text-gray-400">{dayDate(di)}</p>
                            </div>
                          </div>
                        </td>
                        {creators.map(c=>(
                          <td key={c.id} className="px-2 py-3 border-r border-gray-100 last:border-r-0">
                            <SlotPicker value={getSlot(di,c.id)} onChange={slot=>setSlot(di,c.id,slot)}/>
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="space-y-1.5">
                            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                              {Object.entries(daySlots).map(([id,slot])=>{const cov=getCov(slot);if(!cov)return null;return<div key={id} className="absolute top-0 bottom-0 bg-green-400 opacity-70" style={{left:`${((cov.start-SHOP_OPEN)/TOTAL)*100}%`,width:`${((cov.end-cov.start)/TOTAL)*100}%`}}/>})}
                              {gaps.map((g,i)=><div key={i} className="absolute top-0 bottom-0 bg-red-400 opacity-70" style={{left:`${((g.start-SHOP_OPEN)/TOTAL)*100}%`,width:`${((g.end-g.start)/TOTAL)*100}%`}}/>)}
                            </div>
                            {covered?<p className="text-xs font-semibold text-green-600">✓ Couverte</p>:gaps.length>0?gaps.map((g,i)=><p key={i} className="text-xs font-semibold text-red-500">⚠ {g.start}h–{g.end}h vide</p>):<p className="text-xs text-gray-300">Non planifié</p>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Coverage view */}
        {view==='coverage' && (
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Couverture horaire — qui est là à chaque heure</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-gray-500 font-medium w-28">Jour</th>
                    {HOURS.map(h=><th key={h} className="px-1 py-3 text-center text-gray-400 font-medium w-12">{h}h</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day,di)=>{
                    const{daySlots,covered}=dayAnalysis[di]
                    return (
                      <tr key={day} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full',covered?'bg-green-500':'bg-red-400')}/>
                            <span className="font-semibold text-gray-700">{day}</span>
                          </div>
                        </td>
                        {HOURS.map(h=>{
                          const covering=creators.filter(c=>{const s=daySlots[c.id];if(!s)return false;const cov=getCov(s);return cov&&h>=cov.start&&h<cov.end})
                          const isEmpty=covering.length===0
                          return (
                            <td key={h} className="px-1 py-2 text-center">
                              <div className={cn('rounded-md py-1.5 text-xs font-semibold',isEmpty?'bg-red-50 text-red-400 border border-red-100':'bg-green-50 text-green-700 border border-green-100')}
                                title={isEmpty?'Personne':covering.map(c=>c.name).join(', ')}>
                                {isEmpty?'—':covering.length}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-100 border border-green-200 rounded inline-block"/> Nombre de créateurs présents</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-100 border border-red-200 rounded inline-block"/> Créneau vide</span>
            </div>
          </Card>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Légende</p>
          {SLOTS.map(t=>(
            <div key={t.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{background:t.color}}/>
              <span className="text-xs text-gray-600 font-medium">{t.label}</span>
            </div>
          ))}
          <p className="text-xs text-gray-400 ml-auto">Sauvegarde automatique ✓</p>
        </div>
      </div>
    </div>
  )
}
