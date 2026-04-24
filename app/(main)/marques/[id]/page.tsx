'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Globe, Instagram, Mail, Phone, MapPin, Save,
  Package, TrendingUp, Wallet, ShoppingCart, CheckCircle,
  ExternalLink, Pencil, Image as ImageIcon, Calendar, Tag,
  AlertTriangle, ToggleRight, ToggleLeft, Archive, Link, Copy, RefreshCw,
} from 'lucide-react'
import {
  getBrandById, updateBrandFull, getBrandSalesHistory,
  getProductsByBrand, getBrandStats, getReversements,
  uploadBrandLogo, generatePortalToken,
} from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Input, Label, Separator, Spinner, StatCard, EmptyState,
  TooltipProvider, cn, DatePicker,
} from '@/components/ui'
import type { Brand, Product, Reversement } from '@/types'

const fmt      = (n: number) => n.toFixed(2) + ' €'
const fmtShort = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k €' : n.toFixed(0) + ' €'

const CATEGORIES = ['Mode','Bijoux','Cosmétiques','Accessoires','Maison','Art','Lifestyle','Autre']
const CAT_COLORS: Record<string, string> = {
  Mode: '#6366f1', Bijoux: '#f59e0b', Cosmétiques: '#ec4899',
  Accessoires: '#0ea5e9', Maison: '#10b981', Art: '#8b5cf6',
  Lifestyle: '#f97316', Autre: '#6b7280',
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 120, h = 36
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FieldEdit({ label, value, onChange, type = 'text', placeholder = '', prefix, hint, disabled }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; prefix?: React.ReactNode; hint?: string; disabled?: boolean
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{prefix}</span>}
        <Input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className={prefix ? 'pl-9' : ''}/>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function BrandDetailPage() {
  const params = useParams()
  const router = useRouter()
  const brandId = params.id as string

  const [brand, setBrand]         = useState<Brand | null>(null)
  const [products, setProducts]   = useState<Product[]>([])
  const [history, setHistory]     = useState<{ month: string; key: string; revenue: number }[]>([])
  const [reversements, setReversements] = useState<Reversement[]>([])
  const [stats, setStats]         = useState<{ gross: number; net: number; items: number; sales: number } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [activeTab, setActiveTab] = useState<'fiche'|'produits'|'stats'|'reversements'>('fiche')
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Editable form state
  const [form, setForm] = useState({
    name: '', description: '', website: '', instagram: '',
    category: '', join_date: '', contract_end: '',
    commission_rate: '', contact_name: '', contact_email: '',
    contact_phone: '', iban: '', notes: '',
  })

  const set = (key: keyof typeof form, val: string) => {
    setForm(p => ({ ...p, [key]: val }))
    setSaved(false)
  }
  const g = (key: keyof typeof form) => form[key] ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, p, h, r, s] = await Promise.all([
        getBrandById(brandId),
        getProductsByBrand(brandId),
        getBrandSalesHistory(brandId, 6),
        getReversements(brandId),
        getBrandStats(),
      ])
      const br = b as Brand
      setBrand(br)
      setProducts((p as Product[]) || [])
      setHistory(h || [])
      setReversements((r as Reversement[]) || [])

      // Find this brand's stats
      const brandStats = (s as any[]).find(x => x.brand.id === brandId)
      if (brandStats) setStats({
        gross: brandStats.gross_revenue,
        net: brandStats.net_to_pay,
        items: brandStats.items_sold,
        sales: brandStats.sales_count,
      })

      setForm({
        name:            br.name ?? '',
        description:     br.description ?? '',
        website:         br.website ?? '',
        instagram:       br.instagram ?? '',
        category:        br.category ?? '',
        join_date:       br.join_date ?? '',
        contract_end:    br.contract_end ?? '',
        commission_rate: String(br.commission_rate ?? 30),
        contact_name:    br.contact_name ?? '',
        contact_email:   br.contact_email ?? '',
        contact_phone:   br.contact_phone ?? '',
        iban:            br.iban ?? '',
        notes:           br.notes ?? '',
      })
    } finally { setLoading(false) }
  }, [brandId])

  useEffect(() => { load() }, [load])

  const [generatingToken, setGeneratingToken] = useState(false)
  const [tokenCopied, setTokenCopied]         = useState(false)

  const portalUrl = brand
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/createur/${brand.portal_token}`
    : ''

  const handleGenerateToken = async () => {
    if (!confirm("Générer un nouveau lien ? L'ancien sera révoqué.")) return
    setGeneratingToken(true)
    try {
      const token = await generatePortalToken(brandId)
      setBrand(prev => prev ? { ...prev, portal_token: token } : prev)
    } catch (e: any) { alert(e.message) }
    finally { setGeneratingToken(false) }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(portalUrl)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 2000)
  }

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      const updated = await updateBrandFull(brandId, {
        name:            form.name,
        description:     form.description || null,
        website:         form.website || null,
        instagram:       form.instagram || null,
        category:        form.category || null,
        join_date:       form.join_date || null,
        contract_end:    form.contract_end || null,
        commission_rate: form.commission_rate ? Number(form.commission_rate) : null,
        contact_name:    form.contact_name || null,
        contact_email:   form.contact_email || null,
        contact_phone:   form.contact_phone || null,
        iban:            form.iban || null,
        notes:           form.notes || null,
      })
      setBrand(updated as Brand)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  const handleToggleActive = async () => {
    if (!brand) return
    try {
      const updated = await updateBrandFull(brandId, { is_active: !brand.is_active })
      setBrand(updated as Brand)
    } catch (e: any) { alert(e.message) }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadBrandLogo(brandId, file)
      const updated = await updateBrandFull(brandId, { logo_url: url })
      setBrand(updated as Brand)
    } catch (e: any) { alert(e.message) }
    finally { setUploadingLogo(false) }
  }

  const activeProducts   = products.filter(p => p.is_active !== false)
  const archivedProducts = products.filter(p => p.is_active === false)
  const catColor = CAT_COLORS[brand?.category ?? ''] ?? '#6366f1'
  const maxHistory = Math.max(...history.map(h => h.revenue), 1)
  const revenueData = history.map(h => h.revenue)
  const pendingRev = reversements.filter(r => r.status === 'pending').reduce((s, r) => s + r.net_amount, 0)

  const TABS = [
    { id: 'fiche',         label: '📋 Fiche' },
    { id: 'produits',      label: `📦 Produits (${products.length})` },
    { id: 'stats',         label: '📊 Stats' },
    { id: 'reversements',  label: `💶 Reversements (${reversements.length})` },
  ] as const

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-gray-50"><Spinner size="lg"/></div>
  )

  if (!brand) return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <EmptyState icon="🏷" title="Marque introuvable"
        action={<Button onClick={() => router.push('/marques')}><ArrowLeft size={14}/> Retour</Button>}/>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">

        {/* ── Hero banner ── */}
        <div className="h-2 w-full" style={{ background: catColor }}/>
        <div className="bg-white border-b border-gray-100 px-6 py-5">
          <div className="max-w-5xl mx-auto">
            {/* Back + save */}
            <div className="flex items-center justify-between mb-5">
              <Button variant="ghost" size="sm" onClick={() => router.push('/marques')} className="gap-1.5 text-gray-500">
                <ArrowLeft size={15}/> Toutes les marques
              </Button>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                    <CheckCircle size={12}/> Enregistré
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={handleToggleActive} className="gap-1.5">
                  {brand.is_active !== false
                    ? <><ToggleRight size={14} className="text-green-500"/> Active</>
                    : <><ToggleLeft size={14} className="text-gray-400"/> Inactive</>}
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <><Spinner size="sm"/> Enregistrement…</> : <><Save size={14}/> Enregistrer</>}
                </Button>
              </div>
            </div>

            {/* Brand identity */}
            <div className="flex items-start gap-5">
              {/* Logo */}
              <div className="relative shrink-0">
                <button onClick={() => logoInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-400 overflow-hidden flex items-center justify-center bg-gray-50 transition-all group">
                  {uploadingLogo ? (
                    <Spinner size="sm"/>
                  ) : brand.logo_url ? (
                    <>
                      <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil size={16} className="text-white"/>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon size={20} className="text-gray-300"/>
                      <span className="text-[10px] text-gray-400 font-medium">Logo</span>
                    </div>
                  )}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 flex-wrap">
                  <h1 className="text-2xl font-black text-gray-900">{brand.name}</h1>
                  {brand.category && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white mt-1"
                      style={{ background: catColor }}>{brand.category}</span>
                  )}
                  {brand.is_active === false && <Badge variant="secondary">Inactive</Badge>}
                </div>
                {brand.contact_name && (
                  <p className="text-sm text-gray-500 mt-0.5">{brand.contact_name}</p>
                )}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {brand.website && (
                    <a href={brand.website} target="_blank" rel="noopener"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors" onClick={e => e.stopPropagation()}>
                      <Globe size={12}/> Site web
                    </a>
                  )}
                  {brand.instagram && (
                    <a href={`https://instagram.com/${brand.instagram.replace('@','')}`} target="_blank" rel="noopener"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-pink-500 transition-colors" onClick={e => e.stopPropagation()}>
                      <Instagram size={12}/> {brand.instagram}
                    </a>
                  )}
                  {brand.join_date && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={12}/> Depuis le {new Date(brand.join_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick KPIs */}
              {stats && stats.gross > 0 && (
                <div className="hidden lg:flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-black text-gray-900">{fmtShort(stats.gross)}</p>
                    <p className="text-xs text-gray-400">CA total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-green-600">{fmtShort(stats.net)}</p>
                    <p className="text-xs text-gray-400">À reverser</p>
                  </div>
                  <div className="h-12">
                    <Sparkline data={revenueData} color={catColor}/>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={cn('px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                  activeTab === t.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ════════════════════════
              FICHE
          ════════════════════════ */}
          {activeTab === 'fiche' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Identité */}
              <Card>
                <CardHeader><CardTitle>Identité de la marque</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FieldEdit label="Nom de la marque *" value={g('name')} onChange={v => set('name', v)} placeholder="Hadda Studio"/>
                  <div>
                    <Label>Description</Label>
                    <textarea value={g('description')} onChange={e => set('description', e.target.value)}
                      rows={3} placeholder="Décrivez la marque, son univers, ses valeurs…"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
                  </div>
                  <div>
                    <Label>Catégorie</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => set('category', g('category') === cat ? '' : cat)}
                          className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                            g('category') === cat ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                          )}
                          style={g('category') === cat ? { background: CAT_COLORS[cat] } : {}}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date d'entrée boutique</Label>
                      <DatePicker value={g('join_date')} onChange={e => set('join_date', e)}/>
                    </div>
                    <div>
                      <Label>Fin de contrat</Label>
                      <DatePicker value={g('contract_end')} onChange={e => set('contract_end', e)} min={g('join_date')}/>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Présence en ligne */}
              <Card>
                <CardHeader><CardTitle>Présence en ligne</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FieldEdit label="Site web" value={g('website')} onChange={v => set('website', v)}
                    prefix={<Globe size={14}/>} placeholder="https://hadda-studio.com" type="url"/>
                  <FieldEdit label="Instagram" value={g('instagram')} onChange={v => set('instagram', v)}
                    prefix={<Instagram size={14}/>} placeholder="@hadda_studio"/>

                  {g('website') && (
                    <a href={g('website')} target="_blank" rel="noopener"
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                      <ExternalLink size={12}/> Ouvrir le site web
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Contact créateur */}
              <Card>
                <CardHeader><CardTitle>Contact créateur</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FieldEdit label="Nom du créateur" value={g('contact_name')} onChange={v => set('contact_name', v)}
                    placeholder="Marie Dupont"/>
                  <FieldEdit label="Email" value={g('contact_email')} onChange={v => set('contact_email', v)}
                    prefix={<Mail size={14}/>} placeholder="marie@brand.com" type="email"/>
                  <FieldEdit label="Téléphone" value={g('contact_phone')} onChange={v => set('contact_phone', v)}
                    prefix={<Phone size={14}/>} placeholder="06 12 34 56 78" type="tel"/>
                </CardContent>
              </Card>

              {/* Financier */}
              <Card>
                <CardHeader><CardTitle>Informations financières</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Commission boutique (%)</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input type="number" value={g('commission_rate')} onChange={e => set('commission_rate', e.target.value)}
                          min="0" max="100" step="0.5" placeholder="30"
                          className="w-full border border-gray-200 rounded-xl px-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                      <div className="bg-indigo-50 rounded-xl px-4 py-2.5 text-sm shrink-0">
                        <span className="text-indigo-600 font-bold">{g('commission_rate') || 30}% boutique</span>
                        <span className="text-gray-400 mx-1.5">·</span>
                        <span className="text-green-600 font-bold">{(100 - Number(g('commission_rate') || 30)).toFixed(0)}% créateur</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>IBAN</Label>
                    {!g('iban') && (
                      <div className="flex items-center gap-2 text-amber-600 mb-2">
                        <AlertTriangle size={13}/>
                        <span className="text-xs font-medium">IBAN manquant — les reversements ne peuvent pas être effectués</span>
                      </div>
                    )}
                    <Input value={g('iban')} onChange={e => set('iban', e.target.value.toUpperCase())}
                      placeholder="FR76 3000 6000 0112 3456 7890 189" className="font-mono text-sm uppercase"/>
                  </div>
                  <div>
                    <Label>Notes internes</Label>
                    <textarea value={g('notes')} onChange={e => set('notes', e.target.value)} rows={2}
                      placeholder="Conditions particulières, délais, remarques…"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
                  </div>
                </CardContent>
              </Card>

              {/* Portail créateur */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link size={16}/> Portail créateur
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Partagez ce lien unique avec le créateur pour lui donner accès à ses stats en lecture seule — sans accès au back-office.
                  </p>
                  {brand?.portal_token ? (
                    <div className="space-y-3">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                        <p className="text-xs font-mono text-gray-600 flex-1 truncate">{portalUrl}</p>
                        <button onClick={handleCopyUrl}
                          className={cn('shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all',
                            tokenCopied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                          {tokenCopied ? <><CheckCircle size={12}/> Copié</> : <><Copy size={12}/> Copier</>}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                          <a href={portalUrl} target="_blank" rel="noopener"><ExternalLink size={13}/> Aperçu</a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleGenerateToken} disabled={generatingToken}
                          className="gap-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50">
                          {generatingToken ? <Spinner size="sm"/> : <><RefreshCw size={13}/> Regénérer le lien</>}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400">Lecture seule : CA, produits, ventes, reversements.</p>
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-xs text-gray-400">Aucun lien généré pour cette marque.</p>
                      <Button size="sm" onClick={handleGenerateToken} disabled={generatingToken} className="gap-2">
                        {generatingToken ? <Spinner size="sm"/> : <><Link size={13}/> Générer le lien portail</>}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ════════════════════════
              PRODUITS
          ════════════════════════ */}
          {activeTab === 'produits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{activeProducts.length} produit{activeProducts.length > 1 ? 's' : ''} actif{activeProducts.length > 1 ? 's' : ''}</p>
                <Button variant="outline" size="sm" onClick={() => router.push('/produits')}>
                  <Package size={13}/> Gérer les produits
                </Button>
              </div>

              {products.length === 0 ? (
                <EmptyState icon={<Package size={40} className="text-gray-200"/>}
                  title="Aucun produit"
                  description="Ajoutez des produits pour cette marque dans la page Produits"
                  action={<Button variant="outline" onClick={() => router.push('/produits')}><Package size={14}/> Aller aux produits</Button>}/>
              ) : (
                <>
                  {activeProducts.length > 0 && (
                    <Card className="overflow-hidden">
                      <CardHeader><CardTitle>Produits actifs ({activeProducts.length})</CardTitle></CardHeader>
                      <div className="divide-y divide-gray-50">
                        {activeProducts.map(p => (
                          <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-xl object-cover border border-gray-100 shrink-0"/>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                <Package size={16} className="text-gray-300"/>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.reference}</p>
                            </div>
                            <div className="text-right shrink-0">
                              {p.discount ? (
                                <>
                                  <p className="text-sm font-bold text-gray-900">
                                    {(p.price * (1 - p.discount / 100)).toFixed(2)} €
                                  </p>
                                  <p className="text-xs text-gray-400 line-through">{p.price.toFixed(2)} €</p>
                                </>
                              ) : (
                                <p className="text-sm font-bold text-gray-900">{p.price.toFixed(2)} €</p>
                              )}
                            </div>
                            {p.discount && <Badge variant="destructive" size="sm">-{p.discount}%</Badge>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {archivedProducts.length > 0 && (
                    <Card className="overflow-hidden opacity-60">
                      <CardHeader><CardTitle className="text-gray-500">
                        <Archive size={15} className="inline mr-2"/>
                        Archivés ({archivedProducts.length})
                      </CardTitle></CardHeader>
                      <div className="divide-y divide-gray-50">
                        {archivedProducts.map(p => (
                          <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                              <Package size={14} className="text-gray-300"/>
                            </div>
                            <p className="text-sm text-gray-500 flex-1 truncate line-through">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.price.toFixed(2)} €</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════
              STATS
          ════════════════════════ */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="CA total (global)"  value={stats ? fmtShort(stats.gross) : '0 €'} icon={<TrendingUp size={16}/>}/>
                <StatCard label="Net à reverser"      value={stats ? fmtShort(stats.net)   : '0 €'} icon={<Wallet size={16}/>}/>
                <StatCard label="Ventes"              value={stats?.sales ?? 0}                      icon={<ShoppingCart size={16}/>}/>
                <StatCard label="Articles vendus"     value={stats?.items ?? 0}                      icon={<Package size={16}/>}/>
              </div>

              {/* Monthly revenue chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>CA mensuel (6 derniers mois)</span>
                    {revenueData.some(v => v > 0) && (
                      <span className="text-sm font-normal text-gray-500">
                        Total : {fmtShort(revenueData.reduce((a, b) => a + b, 0))}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueData.every(v => v === 0) ? (
                    <EmptyState icon="📊" title="Pas encore de ventes"/>
                  ) : (
                    <div className="space-y-2">
                      {/* Bar chart */}
                      <div className="flex items-end gap-2 h-40">
                        {history.map((h, i) => (
                          <div key={h.key} className="flex-1 flex flex-col items-center gap-1.5">
                            <p className="text-xs font-bold text-gray-700">
                              {h.revenue > 0 ? fmtShort(h.revenue) : ''}
                            </p>
                            <div className="w-full rounded-t-lg transition-all duration-500 min-h-[4px]"
                              style={{
                                height: `${Math.max(4, (h.revenue / maxHistory) * 120)}px`,
                                background: h.revenue > 0 ? catColor : '#F3F4F6',
                              }}/>
                            <p className="text-xs text-gray-400 text-center">{h.month}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Commission breakdown */}
              {stats && stats.gross > 0 && (
                <Card>
                  <CardHeader><CardTitle>Répartition commission</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-6 rounded-full overflow-hidden bg-gray-100 flex">
                        <div className="h-full bg-indigo-400 flex items-center justify-center"
                          style={{ width: `${brand.commission_rate ?? 30}%` }}>
                          <span className="text-white text-xs font-bold px-2">{brand.commission_rate ?? 30}%</span>
                        </div>
                        <div className="h-full bg-green-400 flex-1 flex items-center justify-center">
                          <span className="text-white text-xs font-bold px-2">{(100 - (brand.commission_rate ?? 30)).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">CA brut</p>
                        <p className="text-base font-black text-gray-900">{fmt(stats.gross)}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-indigo-500 mb-1">Commission ({brand.commission_rate ?? 30}%)</p>
                        <p className="text-base font-black text-indigo-700">-{fmt(stats.gross - stats.net)}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-green-600 mb-1">Net créateur</p>
                        <p className="text-base font-black text-green-700">{fmt(stats.net)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ════════════════════════
              REVERSEMENTS
          ════════════════════════ */}
          {activeTab === 'reversements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  {pendingRev > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-600"/>
                      <span className="text-sm font-semibold text-amber-800">
                        {reversements.filter(r => r.status === 'pending').length} reversement{reversements.filter(r => r.status === 'pending').length > 1 ? 's' : ''} en attente · {fmt(pendingRev)}
                      </span>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/reversements')}>
                  <Wallet size={13}/> Page reversements
                </Button>
              </div>

              {reversements.length === 0 ? (
                <EmptyState icon="💶" title="Aucun reversement"
                  description="Les reversements créés dans la page Reversements apparaîtront ici"/>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Période','CA brut','Commission','Net à verser','Statut'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {reversements.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {new Date(r.period_from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              {' → '}
                              {new Date(r.period_to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </td>
                            <td className="px-5 py-3 text-gray-600">{fmt(r.gross_revenue)}</td>
                            <td className="px-5 py-3 text-indigo-600">-{fmt(r.commission)}</td>
                            <td className="px-5 py-3 font-bold text-green-700">{fmt(r.net_amount)}</td>
                            <td className="px-5 py-3">
                              {r.status === 'paid' ? (
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle size={11}/> Payé
                                </Badge>
                              ) : (
                                <Badge variant="warning">⏳ En attente</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td className="px-5 py-3 font-bold text-gray-700">Total</td>
                          <td className="px-5 py-3 font-bold">{fmt(reversements.reduce((s, r) => s + r.gross_revenue, 0))}</td>
                          <td className="px-5 py-3 font-bold text-indigo-700">-{fmt(reversements.reduce((s, r) => s + r.commission, 0))}</td>
                          <td className="px-5 py-3 font-black text-green-700 text-base">{fmt(reversements.reduce((s, r) => s + r.net_amount, 0))}</td>
                          <td/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast saved */}
      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-xl text-sm font-semibold z-50">
          <CheckCircle size={16} className="text-green-400"/> Marque enregistrée
        </div>
      )}
    </TooltipProvider>
  )
}
