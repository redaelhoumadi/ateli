'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  Store, Users, Gift, Save, Plus, Pencil, Trash2,
  CheckCircle, X, ToggleLeft, ToggleRight, Shield,
  Phone, Mail, MapPin, FileText, Percent, CreditCard, Key,
} from 'lucide-react'
import {
  getSettings, updateSettings,
  getAllSellers, createSeller, updateSeller, deleteSeller, updateSellerPin,
} from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Input, Label, Separator, Spinner, StatCard,
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, cn,
} from '@/components/ui'
import type { Seller } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────
function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="lg:col-span-2 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Seller modal ─────────────────────────────────────────────
function SellerModal({ seller, onClose, onSave }: {
  seller?: Seller | null
  onClose: () => void
  onSave: (s: Seller) => void
}) {
  const [form, setForm] = useState({
    name:  seller?.name  ?? '',
    email: seller?.email ?? '',
    phone: seller?.phone ?? '',
    role:  seller?.role  ?? 'seller',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const isEdit = !!seller

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Le nom est requis')
    setSaving(true); setError('')
    try {
      const s = isEdit
        ? await updateSeller(seller!.id, form)
        : await createSeller(form)
      onSave(s as Seller)
      onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  })

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le vendeur' : 'Ajouter un vendeur'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div><Label>Nom <span className="text-red-400">*</span></Label>
              <Input placeholder="Marie Dupont" {...f('name')} autoFocus/>
            </div>
            <div><Label>Email</Label>
              <Input type="email" placeholder="marie@ateli.fr" {...f('email')}/>
            </div>
            <div><Label>Téléphone</Label>
              <Input type="tel" placeholder="06 12 34 56 78" {...f('phone')}/>
            </div>
            <div>
              <Label>Rôle</Label>
              <select {...f('role')}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="seller">Vendeur — accès POS uniquement</option>
                <option value="manager">Gérant — accès complet</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm"/> : isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── TIER EDITOR ─────────────────────────────────────────────
const DEFAULT_TIERS = [
  { id: 'bronze', label: '🥉 Bronze', minSpend: 0,   discount: 0,  color: '#CD7F32' },
  { id: 'silver', label: '🥈 Argent', minSpend: 150, discount: 5,  color: '#9E9E9E' },
  { id: 'gold',   label: '🥇 Or',     minSpend: 300, discount: 10, color: '#D4AF37' },
  { id: 'vip',    label: '💜 VIP',    minSpend: 600, discount: 15, color: '#7C3AED' },
]

// ─── TABS ─────────────────────────────────────────────────────
const TABS = [
  { id: 'boutique', label: 'Boutique',  icon: Store  },
  { id: 'vendeurs', label: 'Vendeurs',  icon: Users  },
  { id: 'fidelite', label: 'Fidélité',  icon: Gift   },
] as const
type TabId = typeof TABS[number]['id']

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function ParametresPage() {
  const [tab, setTab]         = useState<TabId>('boutique')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  // Seller modal
  const [sellerModal, setSellerModal] = useState<Seller | null | 'new'>(null)

  // Local settings edits
  const [local, setLocal] = useState<Record<string, string>>({})
  const set = (key: string, val: string) => {
    setLocal(p => ({ ...p, [key]: val }))
    setSaved(false)
  }
  const get = (key: string) => local[key] ?? settings[key] ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, sel] = await Promise.all([getSettings(), getAllSellers()])
      setSettings(s || {})
      setLocal(s || {})
      setSellers((sel as Seller[]) || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveSettings = async () => {
    setSaving(true); setSaved(false)
    try {
      await updateSettings(local)
      setSettings({ ...settings, ...local })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  // PIN modal
  const [pinModal, setPinModal] = useState<Seller | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinError, setPinError] = useState('')

  const handleSavePin = async () => {
    if (!pinModal) return
    const trimmed = pinInput.trim()
    if (trimmed && (trimmed.length < 4 || !/^\d+$/.test(trimmed)))
      return setPinError('Le PIN doit être composé de 4 à 6 chiffres')
    setPinSaving(true); setPinError('')
    try {
      const updated = await updateSellerPin(pinModal.id, trimmed || null)
      setSellers(prev => prev.map(x => x.id === pinModal.id ? { ...x, pin: trimmed || null } : x))
      setPinModal(null); setPinInput('')
    } catch (e: any) { setPinError(e.message) }
    finally { setPinSaving(false) }
  }

  const handleToggleSeller = async (s: Seller) => {
    try {
      const updated = await updateSeller(s.id, { is_active: !s.is_active })
      setSellers(prev => prev.map(x => x.id === s.id ? updated as Seller : x))
    } catch (e: any) { alert(e.message) }
  }

  const handleDeleteSeller = async (s: Seller) => {
    if (!confirm(`Supprimer ${s.name} définitivement ?`)) return
    try {
      await deleteSeller(s.id)
      setSellers(prev => prev.filter(x => x.id !== s.id))
    } catch (e: any) { alert(e.message || 'Erreur — ce vendeur a peut-être des ventes liées') }
  }

  const activeSellers   = sellers.filter(s => s.is_active)
  const inactiveSellers = sellers.filter(s => !s.is_active)

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <Spinner size="lg"/>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
              <p className="text-gray-500 text-sm mt-0.5">Configuration de votre boutique</p>
            </div>
            {(tab === 'boutique' || tab === 'fidelite') && (
              <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
                {saving ? <><Spinner size="sm"/> Enregistrement…</> :
                 saved   ? <><CheckCircle size={14}/> Enregistré</> :
                           <><Save size={14}/> Enregistrer</>}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                    tab === t.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50')}>
                  <Icon size={15}/>
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* ════════════════════════════════════
              TAB: BOUTIQUE
          ════════════════════════════════════ */}
          {tab === 'boutique' && (
            <div className="space-y-10">

              <Section title="Identité" description="Nom et description affichés dans l'en-tête de l'application et sur les tickets.">
                <Card>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Nom de la boutique">
                        <Input placeholder="Ateli" value={get('shop_name')} onChange={e => set('shop_name', e.target.value)}/>
                      </Field>
                      <Field label="Sous-titre">
                        <Input placeholder="Concept Store" value={get('shop_subtitle')} onChange={e => set('shop_subtitle', e.target.value)}/>
                      </Field>
                    </div>
                    <Field label="SIRET" hint="Affiché sur les tickets d'impression.">
                      <Input placeholder="000 000 000 00000" value={get('shop_siret')} onChange={e => set('shop_siret', e.target.value)}/>
                    </Field>
                  </CardContent>
                </Card>
              </Section>

              <Separator/>

              <Section title="Coordonnées" description="Informations de contact affichées sur les tickets et les exports comptables.">
                <Card>
                  <CardContent className="space-y-4">
                    <Field label="Adresse">
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <Input className="pl-9" placeholder="12 rue des Créateurs, 75011 Paris"
                          value={get('shop_address')} onChange={e => set('shop_address', e.target.value)}/>
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Téléphone">
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                          <Input className="pl-9" type="tel" placeholder="01 23 45 67 89"
                            value={get('shop_phone')} onChange={e => set('shop_phone', e.target.value)}/>
                        </div>
                      </Field>
                      <Field label="Email">
                        <div className="relative">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                          <Input className="pl-9" type="email" placeholder="bonjour@ateli.fr"
                            value={get('shop_email')} onChange={e => set('shop_email', e.target.value)}/>
                        </div>
                      </Field>
                    </div>
                  </CardContent>
                </Card>
              </Section>

              <Separator/>

              <Section title="Tickets & reçus" description="Textes affichés sur les tickets imprimés.">
                <Card>
                  <CardContent className="space-y-4">
                    <Field label="Message de fin de ticket" hint="Ex: Merci de votre visite ! Échanges sous 30 jours.">
                      <textarea value={get('receipt_footer')} onChange={e => set('receipt_footer', e.target.value)}
                        rows={2} placeholder="Merci de votre visite !"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
                    </Field>
                  </CardContent>
                </Card>
              </Section>

              <Separator/>

              <Section title="Commissions" description="Taux de commission par défaut appliqué aux nouvelles marques. Peut être modifié marque par marque dans la page Reversements.">
                <Card>
                  <CardContent>
                    <Field label="Commission boutique par défaut (%)" hint="Ex: 30 signifie que la boutique garde 30% du CA de chaque marque.">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                          <Input type="number" className="pl-9" min="0" max="100" step="0.5"
                            placeholder="30" value={get('commission_default')} onChange={e => set('commission_default', e.target.value)}/>
                        </div>
                        {get('commission_default') && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-sm">
                            <span className="text-indigo-600 font-semibold">{get('commission_default')}% boutique</span>
                            <span className="text-gray-400 mx-2">·</span>
                            <span className="text-green-600 font-semibold">{(100 - Number(get('commission_default'))).toFixed(0)}% créateur</span>
                          </div>
                        )}
                      </div>
                    </Field>
                  </CardContent>
                </Card>
              </Section>

            </div>
          )}

          {/* ════════════════════════════════════
              TAB: VENDEURS
          ════════════════════════════════════ */}
          {tab === 'vendeurs' && (
            <div className="space-y-6">

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Vendeurs actifs"   value={activeSellers.length}   icon={<Users size={16}/>}/>
                <StatCard label="Gérants"            value={sellers.filter(s => s.role === 'manager').length} icon={<Shield size={16}/>}/>
                <StatCard label="Inactifs"           value={inactiveSellers.length} icon={<ToggleLeft size={16}/>}/>
              </div>

              {/* Active sellers */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Équipe ({activeSellers.length})</CardTitle>
                    <Button size="sm" onClick={() => setSellerModal('new')} className="gap-1.5">
                      <Plus size={14}/> Ajouter
                    </Button>
                  </div>
                </CardHeader>

                {activeSellers.length === 0 ? (
                  <CardContent>
                    <div className="text-center py-10">
                      <Users size={36} className="text-gray-200 mx-auto mb-3"/>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Aucun vendeur actif</p>
                      <p className="text-xs text-gray-400 mb-4">Ajoutez votre premier vendeur</p>
                      <Button size="sm" onClick={() => setSellerModal('new')}><Plus size={14}/> Ajouter un vendeur</Button>
                    </div>
                  </CardContent>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {activeSellers.map(s => (
                      <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
                        {/* Avatar */}
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0',
                          s.role === 'manager' ? 'bg-indigo-500' : 'bg-gray-400'
                        )}>
                          {s.name[0].toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                            <Badge variant={s.role === 'manager' ? 'info' : 'secondary'} size="sm">
                              {s.role === 'manager' ? '🛡 Gérant' : 'Vendeur'}
                            </Badge>
                            {s.pin ? (
                              <Badge variant="success" size="sm" className="gap-1"><Key size={9}/> PIN défini</Badge>
                            ) : (
                              <Badge variant="secondary" size="sm" className="text-amber-600 border-amber-200 bg-amber-50">Sans PIN</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {s.email && <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10}/> {s.email}</p>}
                            {s.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10}/> {s.phone}</p>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => setSellerModal(s)}>
                            <Pencil size={13}/>
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm"
                                onClick={() => { setPinModal(s); setPinInput(s.pin ?? ''); setPinError('') }}
                                className={cn('transition-colors', s.pin ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600')}>
                                <Key size={13}/>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{s.pin ? 'Modifier le PIN' : 'Définir un PIN'}</TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleToggleSeller(s)}
                            className="text-amber-500 hover:text-amber-700 hover:bg-amber-50">
                            <ToggleRight size={15}/>
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteSeller(s)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 size={13}/>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Inactive sellers */}
              {inactiveSellers.length > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader><CardTitle className="text-gray-500">Inactifs ({inactiveSellers.length})</CardTitle></CardHeader>
                  <div className="divide-y divide-gray-50">
                    {inactiveSellers.map(s => (
                      <div key={s.id} className="flex items-center gap-4 px-6 py-3.5 opacity-50 hover:opacity-80 transition-opacity group">
                        <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                          {s.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 line-through">{s.name}</p>
                          <p className="text-xs text-gray-400">Compte désactivé</p>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleToggleSeller(s)}
                            className="text-green-500 hover:text-green-700 hover:bg-green-50">
                            <ToggleLeft size={15}/>
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteSeller(s)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 size={13}/>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Roles info */}
              <Card>
                <CardHeader><CardTitle>Niveaux d'accès</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {[
                      {
                        role: '🛡 Gérant', color: 'bg-indigo-50 border-indigo-100',
                        perms: ['Accès POS complet', 'Dashboard & analyses', 'Gestion produits & marques', 'Reversements', 'Clôture de caisse', 'Paramètres boutique'],
                      },
                      {
                        role: '👤 Vendeur', color: 'bg-gray-50 border-gray-100',
                        perms: ['Accès POS uniquement', 'Historique de caisse du jour', 'Sélection client fidélité'],
                      },
                    ].map(({ role, color, perms }) => (
                      <div key={role} className={cn('rounded-xl border p-4', color)}>
                        <p className="text-sm font-bold text-gray-900 mb-2">{role}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {perms.map(p => (
                            <span key={p} className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full">{p}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ════════════════════════════════════
              TAB: FIDÉLITÉ
          ════════════════════════════════════ */}
          {tab === 'fidelite' && (
            <div className="space-y-10">

              <Section
                title="Paliers de fidélité"
                description="Seuils et remises du programme fidélité. Ces valeurs sont affichées dans le portail client et appliquées automatiquement en caisse."
              >
                <div className="space-y-3">
                  {DEFAULT_TIERS.map((tier, i) => {
                    const minKey      = `tier_${tier.id}_min`
                    const discKey     = `tier_${tier.id}_discount`
                    const minVal      = get(minKey)      || String(tier.minSpend)
                    const discVal     = get(discKey)     || String(tier.discount)
                    const isFirst     = i === 0

                    return (
                      <Card key={tier.id} className="overflow-hidden">
                        <div className="flex items-start gap-4 p-5">
                          <div className="text-2xl shrink-0 mt-0.5">{tier.label.split(' ')[0]}</div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm font-bold text-gray-900 mb-3">{tier.label.split(' ').slice(1).join(' ')}</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                <p>Couleur : <span className="font-mono">{tier.color}</span></p>
                              </div>
                            </div>
                            <div>
                              <Label>Seuil minimum (€)</Label>
                              <div className="relative">
                                <Input type="number" min="0" step="10"
                                  value={minVal} disabled={isFirst}
                                  onChange={e => set(minKey, e.target.value)}
                                  className={isFirst ? 'opacity-50' : ''}/>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                              </div>
                              {isFirst && <p className="text-xs text-gray-400 mt-1">Toujours 0 € (palier de départ)</p>}
                            </div>
                            <div>
                              <Label>Remise (%)</Label>
                              <div className="relative">
                                <Input type="number" min="0" max="100" step="1"
                                  value={discVal} disabled={isFirst}
                                  onChange={e => set(discKey, e.target.value)}
                                  className={isFirst ? 'opacity-50' : ''}/>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                              </div>
                              {isFirst && <p className="text-xs text-gray-400 mt-1">Pas de remise au palier Bronze</p>}
                            </div>
                          </div>
                        </div>
                        {/* Preview bar */}
                        {!isFirst && (
                          <div className="border-t border-gray-100 px-5 py-2.5 flex items-center gap-3 bg-gray-50">
                            <div className="h-2 flex-1 rounded-full" style={{ background: `${tier.color}22` }}>
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(100, (Number(discVal) / 20) * 100)}%`,
                                background: tier.color,
                              }}/>
                            </div>
                            <p className="text-xs font-semibold shrink-0" style={{ color: tier.color }}>
                              Dès {minVal} € → -{discVal}%
                            </p>
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                  <p className="text-xs text-amber-800">
                    <strong>Important :</strong> Modifier ces valeurs affecte uniquement l'affichage dans le portail client et les nouveaux calculs de remise. Les clients qui ont déjà atteint un palier gardent leur statut.
                    Pour appliquer les nouveaux seuils dans le code, mettez également à jour <code className="font-mono bg-amber-100 px-1 rounded">lib/customerPortal.ts</code>.
                  </p>
                </div>
              </Section>

              <Separator/>

              <Section title="Programme en chiffres" description="Aperçu du programme fidélité actuel.">
                <div className="grid grid-cols-2 gap-3">
                  {DEFAULT_TIERS.map(tier => (
                    <div key={tier.id} className="rounded-2xl border-2 p-4 flex items-center gap-3"
                      style={{ borderColor: `${tier.color}33`, background: `${tier.color}08` }}>
                      <span className="text-2xl">{tier.label.split(' ')[0]}</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: tier.color }}>
                          {tier.label.split(' ').slice(1).join(' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tier.minSpend === 0 ? 'Dès le 1er achat' : `Dès ${tier.minSpend} €`}
                          {tier.discount > 0 ? ` · -${tier.discount}%` : ' · Pas de remise'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Save floating feedback */}
          {saved && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-xl text-sm font-semibold z-50 animate-in fade-in-0 zoom-in-95">
              <CheckCircle size={16} className="text-green-400"/>
              Paramètres enregistrés
            </div>
          )}
        </div>
      </div>

      {/* PIN modal */}
      {pinModal && (
        <Dialog open onOpenChange={o => !o && setPinModal(null)}>
          <DialogContent className="max-w-xs overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Code PIN — {pinModal.name}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-black mx-auto"
                    style={{ background: pinModal.role === 'manager' ? '#4338CA' : '#374151' }}>
                    {pinModal.name[0]}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{pinModal.name}</p>
                </div>
                <div>
                  <Label>Code PIN (4 à 6 chiffres)</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Ex: 1234"
                    value={pinInput}
                    onChange={e => { setPinInput(e.target.value.replace(/\D/g,'')); setPinError('') }}
                    className="text-center tracking-widest font-mono text-lg"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Laissez vide pour supprimer le PIN (accès libre).
                  </p>
                </div>
                {pinError && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{pinError}</p>}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-800 mb-1">🔐 Fonctionnement</p>
                  <p className="text-xs text-indigo-700">Ce code sera demandé à chaque connexion sur l'écran de sélection vendeur.</p>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPinModal(null)} disabled={pinSaving}>Annuler</Button>
              <Button onClick={handleSavePin} disabled={pinSaving}>
                {pinSaving ? <Spinner size="sm"/> : pinInput ? 'Enregistrer le PIN' : 'Supprimer le PIN'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Seller modal */}
      {sellerModal && (
        <SellerModal
          seller={sellerModal === 'new' ? null : sellerModal}
          onClose={() => setSellerModal(null)}
          onSave={s => {
            setSellers(prev => {
              const exists = prev.find(x => x.id === s.id)
              return exists ? prev.map(x => x.id === s.id ? s : x) : [...prev, s]
            })
          }}
        />
      )}
    </TooltipProvider>
  )
}
