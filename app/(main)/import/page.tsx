'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Download, CheckCircle, AlertTriangle, X,
  FileText, ChevronRight, RefreshCw, Package,
  Info, ArrowLeft,
} from 'lucide-react'
import {
  parseCsv, validateRows, importProducts,
  downloadCsvTemplate, generateCsvTemplate,
  type ParsedProduct, type ImportResult,
} from '@/lib/csvImport'
import { getBrands, getAllProducts } from '@/lib/supabase'
import {
  Button, Badge, Card, CardHeader, CardTitle, CardContent,
  Separator, Spinner, TooltipProvider, cn,
} from '@/components/ui'
import type { Brand } from '@/types'

// ─── Steps ────────────────────────────────────────────────────
type Step = 'upload' | 'preview' | 'importing' | 'done'

const STATUS_CONFIG = {
  valid:     { label: 'Nouveau',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100',  dot: 'bg-green-500' },
  warning:   { label: 'Attention',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100',  dot: 'bg-amber-500' },
  duplicate: { label: 'Mise à jour', color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-100',   dot: 'bg-blue-500' },
  error:     { label: 'Erreur',     color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-100',    dot: 'bg-red-500' },
}

export default function ImportPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep]             = useState<Step>('upload')
  const [dragging, setDragging]     = useState(false)
  const [fileName, setFileName]     = useState('')
  const [rows, setRows]             = useState<ParsedProduct[]>([])
  const [brands, setBrands]         = useState<Brand[]>([])
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set())
  const [loading, setLoading]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [error, setError]           = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'valid'|'duplicate'|'warning'|'error'>('all')
  const [ignoreErrors, setIgnoreErrors] = useState(false)

  // Stats
  const validCount     = rows.filter(r => r.status === 'valid').length
  const warningCount   = rows.filter(r => r.status === 'warning').length
  const duplicateCount = rows.filter(r => r.status === 'duplicate').length
  const errorCount     = rows.filter(r => r.status === 'error').length
  const importableCount = rows.filter(r => r.status !== 'error').length

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.name.endsWith('.txt')) {
      setError('Veuillez sélectionner un fichier .csv')
      return
    }
    setError(''); setLoading(true); setFileName(file.name)
    try {
      const text    = await file.text()
      const { headers, rows: csvRows } = parseCsv(text)

      if (!headers.includes('name') || !headers.includes('reference') || !headers.includes('price') || !headers.includes('brand')) {
        setError(`Colonnes requises manquantes. Colonnes trouvées : ${headers.join(', ')}\nColonnes requises : name, reference, price, brand`)
        setLoading(false); return
      }
      if (csvRows.length === 0) {
        setError('Le fichier est vide (aucune ligne de données)')
        setLoading(false); return
      }

      // Load brands and existing products in parallel
      const [brandsData, prodsData] = await Promise.all([getBrands(), getAllProducts()])
      const brandsArr = (brandsData as Brand[]) || []
      const prodsArr  = (prodsData as any[]) || []

      setBrands(brandsArr)
      const refs = new Set(prodsArr.map(p => p.reference))
      setExistingRefs(refs)

      const brandMap = new Map(brandsArr.map(b => [b.name.toLowerCase(), b.id]))
      const parsed   = validateRows(headers, csvRows, refs, brandMap)

      setRows(parsed)
      setStep('preview')
    } catch (e: any) {
      setError(e.message || 'Erreur de lecture du fichier')
    } finally { setLoading(false) }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleImport = async () => {
    setStep('importing')
    setProgress(0)
    const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]))
    try {
      const res = await importProducts(
        ignoreErrors ? rows : rows.filter(r => r.status !== 'error'),
        brandMap,
        (done, total) => { setProgress(done); setProgressTotal(total) },
      )
      setResult(res)
      setStep('done')
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'import')
      setStep('preview')
    }
  }

  const reset = () => {
    setStep('upload'); setRows([]); setFileName('')
    setResult(null); setError(''); setProgress(0)
  }

  const filtered = filterStatus === 'all' ? rows : rows.filter(r => r.status === filterStatus)

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/produits')} className="gap-1.5 text-gray-500">
                <ArrowLeft size={15}/> Produits
              </Button>
              <Separator orientation="vertical" className="h-5"/>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Import CSV</h1>
                <p className="text-gray-500 text-sm">Importer des produits en masse depuis un fichier CSV</p>
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {(['upload','preview','importing','done'] as Step[]).map((s, i) => {
              const labels = ['1. Fichier', '2. Prévisualisation', '3. Import', '4. Résultat']
              const active  = s === step
              const done    = ['upload','preview','importing','done'].indexOf(s) < ['upload','preview','importing','done'].indexOf(step)
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn('flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                    active ? 'bg-gray-900 text-white border-gray-900' :
                    done   ? 'bg-green-50 text-green-700 border-green-200' :
                             'bg-white text-gray-400 border-gray-200')}>
                    {done ? <CheckCircle size={11}/> : null}
                    {labels[i]}
                  </div>
                  {i < 3 && <ChevronRight size={14} className="text-gray-300 shrink-0"/>}
                </div>
              )
            })}
          </div>

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Template download */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download size={16}/> Télécharger le modèle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Commencez par télécharger le modèle CSV, remplissez-le avec vos produits, puis importez-le ci-dessous.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
                      <thead className="bg-gray-50">
                        <tr>
                          {['name *', 'reference *', 'price *', 'brand *', 'discount', 'stock', 'stock_min'].map(h => (
                            <th key={h} className={cn('px-3 py-2 text-left font-bold tracking-wide', h.includes('*') ? 'text-gray-900' : 'text-gray-400')}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[
                          ['T-shirt oversize', 'TSH-001', '29.90', 'Hadda Studio', '10', '5', '2'],
                          ['Bracelet jonc doré', 'BRC-001', '49.90', 'Kifahari', '', '3', '1'],
                          ['Bougie lavande', 'BOU-001', '18.00', 'Maison Éphory', '', '', ''],
                        ].map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {row.map((cell, j) => (
                              <td key={j} className={cn('px-3 py-2 font-mono', cell ? 'text-gray-700' : 'text-gray-300')}>
                                {cell || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="gap-2">
                      <Download size={13}/> Télécharger le modèle CSV
                    </Button>
                    <p className="text-xs text-gray-400">
                      * Colonnes obligatoires · discount en % · stock en unités
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
                  dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                )}>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}/>

                {loading ? (
                  <><Spinner size="lg"/><p className="text-sm text-gray-500 font-medium">Analyse du fichier…</p></>
                ) : (
                  <>
                    <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
                      dragging ? 'bg-indigo-100' : 'bg-gray-100')}>
                      <Upload size={28} className={dragging ? 'text-indigo-600' : 'text-gray-400'}/>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-900">
                        {dragging ? 'Relâchez pour importer' : 'Glissez votre fichier CSV ici'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">ou cliquez pour sélectionner un fichier</p>
                    </div>
                    <Badge variant="secondary">.csv · encodage UTF-8</Badge>
                  </>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Erreur de lecture</p>
                    <pre className="text-xs text-red-700 mt-1 whitespace-pre-wrap font-mono">{error}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <FileText size={15}/>
                  <span className="font-medium">{fileName}</span>
                  <span>· {rows.length} ligne{rows.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {validCount > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
                      {validCount} nouveau{validCount > 1 ? 'x' : ''}
                    </span>
                  )}
                  {duplicateCount > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                      {duplicateCount} mise{duplicateCount > 1 ? 's' : ''} à jour
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
                      {warningCount} avertissement{warningCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                      {errorCount} erreur{errorCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button onClick={reset} className="ml-auto text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                  <X size={13}/> Changer de fichier
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { id: 'all',       label: 'Toutes', count: rows.length },
                  { id: 'valid',     label: 'Nouveaux', count: validCount },
                  { id: 'duplicate', label: 'Mises à jour', count: duplicateCount },
                  { id: 'warning',   label: 'Avertissements', count: warningCount },
                  { id: 'error',     label: 'Erreurs', count: errorCount },
                ] as const).filter(f => f.count > 0 || f.id === 'all').map(f => (
                  <button key={f.id} onClick={() => setFilterStatus(f.id)}
                    className={cn('flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all',
                      filterStatus === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                    {f.label}
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold',
                      filterStatus === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Preview table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                      <tr>
                        {['Ligne', 'Statut', 'Nom', 'Référence', 'Prix', 'Marque', 'Remise', 'Stock', 'Notes'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(row => {
                        const cfg = STATUS_CONFIG[row.status]
                        return (
                          <tr key={row.rowIndex} className={cn('transition-colors', row.status === 'error' && 'bg-red-50/40')}>
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">{row.rowIndex}</td>
                            <td className="px-4 py-3">
                              <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border w-fit whitespace-nowrap', cfg.bg, cfg.color, cfg.border)}>
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)}/>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px]">
                              <p className="truncate">{row.name || <span className="text-red-400 italic">manquant</span>}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.reference || '—'}</td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {row.price ? `${row.price.toFixed(2)} €` : <span className="text-red-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-700 max-w-[120px]">
                              <p className="truncate">{row.brand || '—'}</p>
                              {!brands.find(b => b.name.toLowerCase() === row.brand.toLowerCase()) && row.brand && (
                                <p className="text-[10px] text-amber-600 font-medium">+ Sera créée</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.discount != null ? `${row.discount}%` : '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{row.stock != null ? row.stock : '—'}</td>
                            <td className="px-4 py-3 max-w-[200px]">
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600 font-medium">{e}</p>
                              ))}
                              {row.warnings.map((w, i) => (
                                <p key={i} className="text-xs text-amber-600">{w}</p>
                              ))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Options */}
              {errorCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Info size={15} className="text-amber-600 shrink-0 mt-0.5"/>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 mb-2">
                      {errorCount} ligne{errorCount > 1 ? 's' : ''} avec erreurs seront ignorées par défaut.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={ignoreErrors} onChange={e => setIgnoreErrors(e.target.checked)}
                        className="rounded border-amber-300 text-amber-600"/>
                      <span className="text-xs text-amber-700 font-medium">Tenter quand même d'importer les lignes avec erreurs</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <Button variant="outline" onClick={reset} className="gap-2">
                  <X size={14}/> Annuler
                </Button>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">
                    <span className="font-bold text-gray-900">{importableCount}</span> produit{importableCount > 1 ? 's' : ''} à importer
                  </p>
                  <Button onClick={handleImport} disabled={importableCount === 0} size="lg" className="gap-2">
                    <Upload size={15}/> Lancer l'import
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === 'importing' && (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <RefreshCw size={28} className="text-indigo-600 animate-spin"/>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-bold text-gray-900">Import en cours…</p>
                  <p className="text-sm text-gray-500">{progress} / {progressTotal || importableCount} produits traités</p>
                </div>
                {/* Progress bar */}
                <div className="w-full max-w-sm">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressTotal > 0 ? (progress / progressTotal) * 100 : 0}%` }}/>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Ne fermez pas cette page</p>
              </CardContent>
            </Card>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && result && (
            <div className="space-y-6">
              {/* Result summary */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="bg-green-500 px-6 py-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle size={24} className="text-green-500"/>
                  </div>
                  <div>
                    <p className="text-white font-black text-xl">Import terminé !</p>
                    <p className="text-green-100 text-sm">
                      {result.created + result.updated} produit{result.created + result.updated > 1 ? 's' : ''} traité{result.created + result.updated > 1 ? 's' : ''} avec succès
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
                  {[
                    { label: 'Créés',        value: result.created,      color: 'text-green-600' },
                    { label: 'Mis à jour',   value: result.updated,      color: 'text-blue-600'  },
                    { label: 'Marques créées', value: result.brandCreated, color: 'text-amber-600' },
                    { label: 'Erreurs',      value: result.errors,       color: 'text-red-600'   },
                  ].map(stat => (
                    <div key={stat.label} className="px-5 py-4 text-center">
                      <p className={cn('text-2xl font-black', stat.color)}>{stat.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail log */}
              {result.details.length > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader><CardTitle>Journal d'import</CardTitle></CardHeader>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {result.details.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                        {d.status === 'created' && <CheckCircle size={14} className="text-green-500 shrink-0"/>}
                        {d.status === 'updated' && <RefreshCw size={14} className="text-blue-500 shrink-0"/>}
                        {d.status === 'error'   && <X size={14} className="text-red-500 shrink-0"/>}
                        <span className="text-sm font-medium text-gray-900 truncate">{d.name}</span>
                        <span className="text-xs font-mono text-gray-400">{d.reference}</span>
                        {d.message && <span className="text-xs text-red-500 ml-auto shrink-0 truncate max-w-[200px]">{d.message}</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset} className="gap-2">
                  <Upload size={14}/> Nouvel import
                </Button>
                <Button onClick={() => router.push('/produits')} className="gap-2">
                  <Package size={14}/> Voir les produits →
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
