'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Plus, Tag, Package, Archive, RotateCcw, Trash2, Pencil, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react'
import {
  getProducts, getBrands, createProduct, updateProduct,
  deleteProduct, archiveProduct, restoreProduct, createBrand,
  uploadProductImage, deleteProductImage,
} from '@/lib/supabase'
import { ProductImageUpload } from '@/components/ui/ProductImageUpload'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Button, Badge, Card, Input, Label, Textarea, Separator,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Checkbox, Spinner, StatCard, EmptyState, cn,
} from '@/components/ui'
import type { Product, Brand } from '@/types'

type ProductForm = {
  name: string; reference: string; price: string
  discount: string; brand_id: string; image_url: string | null
}
const emptyForm: ProductForm = { name: '', reference: '', price: '', discount: '', brand_id: '', image_url: null }

export default function ProduitsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [brands, setBrands]         = useState<Brand[]>([])
  const [loading, setLoading]       = useState(true)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [search, setSearch]         = useState('')
  const [filterBrand, setFilterBrand] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [modal, setModal]           = useState<'add'|'edit'|'delete'|'brand'|null>(null)
  const [editTarget, setEditTarget] = useState<Product|null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product|null>(null)
  const [deleteMode, setDeleteMode] = useState<'confirm'|'linked'|null>(null)
  const [form, setForm]             = useState<ProductForm>(emptyForm)
  const [newBrandName, setNewBrandName] = useState('')
  const [saving, setSaving]         = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError]           = useState('')
  const [pageSize, setPageSize]     = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortCol, setSortCol]       = useState<'name'|'price'|'brand'>('name')
  const [sortDir, setSortDir]       = useState<'asc'|'desc'>('asc')

  useEffect(() => { setCurrentPage(1) }, [search, filterBrand, showArchived, pageSize])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b] = await Promise.all([getProducts(), getBrands()])
      setProducts((p as Product[]) || [])
      setBrands((b as Brand[]) || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { loadAll() }, [loadAll])

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      const ms = !search || p.name.toLowerCase().includes(search.toLowerCase())
        || p.reference.toLowerCase().includes(search.toLowerCase())
        || p.brand?.name?.toLowerCase().includes(search.toLowerCase())
      const mb = filterBrand === 'all' || p.brand_id === filterBrand
      const ma = showArchived ? (p as any).is_active === false : (p as any).is_active !== false
      return ms && mb && ma
    })
    list = [...list].sort((a, b) => {
      let d = 0
      if (sortCol === 'name')  d = a.name.localeCompare(b.name)
      if (sortCol === 'price') d = a.price - b.price
      if (sortCol === 'brand') d = (a.brand?.name||'').localeCompare(b.brand?.name||'')
      return sortDir === 'asc' ? d : -d
    })
    return list
  }, [products, search, filterBrand, showArchived, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageStart  = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd    = Math.min(currentPage * pageSize, filtered.length)

  const activeCount   = products.filter(p => (p as any).is_active !== false).length
  const archivedCount = products.filter(p => (p as any).is_active === false).length
  const avgPrice      = activeCount ? products.filter(p => (p as any).is_active !== false).reduce((s,p) => s + p.price, 0) / activeCount : 0
  const withDiscount  = products.filter(p => p.discount && p.discount > 0 && (p as any).is_active !== false).length
  const finalPrice    = (p: Product) => p.discount ? p.price * (1 - p.discount / 100) : p.price

  // Selection
  const allSel = filtered.length > 0 && filtered.every(p => selected.has(p.id))
  const someSel = selected.size > 0
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => {
    if (allSel) setSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.delete(p.id)); return n })
    else setSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.add(p.id)); return n })
  }
  const clearSel = () => setSelected(new Set())

  // Bulk ops
  const bulkArchive = async () => {
    setBulkLoading(true)
    try { await Promise.all([...selected].map(id => archiveProduct(id))); setProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, is_active: false } : p)); clearSel() }
    catch (e: any) { alert(e.message) } finally { setBulkLoading(false) }
  }
  const bulkRestore = async () => {
    setBulkLoading(true)
    try { await Promise.all([...selected].map(id => restoreProduct(id))); setProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, is_active: true } : p)); clearSel() }
    catch (e: any) { alert(e.message) } finally { setBulkLoading(false) }
  }
  const archiveAll = async () => {
    if (!confirm(`Archiver tous les ${activeCount} produits actifs ?`)) return
    setBulkLoading(true)
    try { const ids = products.filter(p => (p as any).is_active !== false).map(p => p.id); await Promise.all(ids.map(id => archiveProduct(id))); setProducts(prev => prev.map(p => ({ ...p, is_active: false }))); clearSel() }
    catch (e: any) { alert(e.message) } finally { setBulkLoading(false) }
  }
  const restoreAll = async () => {
    if (!confirm(`Restaurer tous les ${archivedCount} produits archivés ?`)) return
    setBulkLoading(true)
    try { const ids = products.filter(p => (p as any).is_active === false).map(p => p.id); await Promise.all(ids.map(id => restoreProduct(id))); setProducts(prev => prev.map(p => ({ ...p, is_active: true }))); clearSel() }
    catch (e: any) { alert(e.message) } finally { setBulkLoading(false) }
  }

  // CRUD
  const openAdd  = () => { setForm({ ...emptyForm, brand_id: brands[0]?.id || '' }); setError(''); setModal('add') }
  const openEdit = (p: Product) => { setEditTarget(p); setForm({ name: p.name, reference: p.reference, price: String(p.price), discount: p.discount != null ? String(p.discount) : '', brand_id: p.brand_id, image_url: (p as any).image_url ?? null }); setError(''); setModal('edit') }
  const openDelete = (p: Product) => { setDeleteTarget(p); setDeleteMode(null); setError(''); setModal('delete') }
  const closeModal = () => { setModal(null); setEditTarget(null); setDeleteTarget(null); setError('') }

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Le nom est obligatoire')
    if (!form.reference.trim()) return setError('La référence est obligatoire')
    if (!form.price || isNaN(Number(form.price))) return setError('Prix invalide')
    if (!form.brand_id) return setError('Sélectionnez une marque')
    const disc = form.discount !== '' && !isNaN(Number(form.discount)) ? Number(form.discount) : null
    if (disc != null && (disc < 0 || disc > 100)) return setError('Remise entre 0 et 100 %')
    setSaving(true); setError('')
    try {
      const payload = { name: form.name.trim(), reference: form.reference.trim().toUpperCase(), price: Number(form.price), discount: disc, brand_id: form.brand_id, image_url: form.image_url }
      if (modal === 'add') {
        const created = await createProduct(payload)
        setProducts(prev => [...prev, created as Product].sort((a,b) => a.name.localeCompare(b.name)))
      } else if (editTarget) {
        const updated = await updateProduct(editTarget.id, payload)
        setProducts(prev => prev.map(p => p.id === editTarget.id ? updated as Product : p))
      }
      closeModal()
    } catch (e: any) { setError(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true); setError('')
    try { await deleteProduct(deleteTarget.id); setProducts(prev => prev.filter(p => p.id !== deleteTarget.id)); closeModal() }
    catch (e: any) { e.message === 'LINKED' ? setDeleteMode('linked') : setError(e.message) }
    finally { setSaving(false) }
  }

  const handleArchiveSingle = async () => {
    if (!deleteTarget) return
    setSaving(true); setError('')
    try { await archiveProduct(deleteTarget.id); setProducts(prev => prev.map(p => p.id === deleteTarget.id ? { ...p, is_active: false } : p)); closeModal() }
    catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const handleRestoreSingle = async (p: Product) => {
    try { await restoreProduct(p.id); setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, is_active: true } : pr)) }
    catch (e: any) { alert(e.message) }
  }

  const handleImageUpload = async (file: File) => {
    setImageUploading(true)
    try { const url = await uploadProductImage(editTarget?.id ?? `temp-${Date.now()}`, file); setForm(f => ({ ...f, image_url: url })) }
    catch (e: any) { setError(e.message) } finally { setImageUploading(false) }
  }
  const handleImageRemove = async () => {
    if (form.image_url) { try { await deleteProductImage(form.image_url) } catch {} }
    setForm(f => ({ ...f, image_url: null }))
  }

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return
    setSaving(true)
    try {
      const b = await createBrand(newBrandName.trim())
      setBrands(prev => [...prev, b as Brand].sort((a,z) => a.name.localeCompare(z.name)))
      setForm(f => ({ ...f, brand_id: (b as Brand).id }))
      setNewBrandName('')
      setModal(modal === 'brand' ? null : modal)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const SortBtn = ({ col, label }: { col: typeof sortCol; label: string }) => (
    <button onClick={() => { sortCol === col ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortCol(col), setSortDir('asc')) }}
      className={cn('flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors', sortCol === col ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600')}>
      {label}
      {sortCol === col ? (sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>) : <ChevronDown size={12} className="opacity-30"/>}
    </button>
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-8xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Catalogue produits</h1>
              <p className="text-gray-500 text-sm mt-0.5">Gérez vos produits et vos marques</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setNewBrandName(''); setError(''); setModal('brand') }}>
                <Tag size={14}/> Nouvelle marque
              </Button>
              <Button onClick={openAdd}>
                <Plus size={14}/> Ajouter un produit
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Produits actifs"  value={activeCount}              icon={<Package size={18}/>}/>
            <StatCard label="Archivés"          value={archivedCount}            icon={<Archive size={18}/>}/>
            <StatCard label="Prix moyen"        value={`${avgPrice.toFixed(2)} €`} icon={<span className="text-base">💶</span>}/>
            <StatCard label="En promotion"      value={withDiscount}             icon={<Tag size={18}/>}/>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <Input icon={<Search size={14}/>} placeholder="Nom, référence ou marque…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1"/>
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les marques"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les marques</SelectItem>
                {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={showArchived ? 'default' : 'outline'} onClick={() => { setShowArchived(!showArchived); clearSel() }}>
              <Archive size={14}/> {showArchived ? 'Archivés' : 'Voir archivés'}
            </Button>
          </div>

          {/* Global bulk */}
          <div className="flex items-center gap-3">
            {!showArchived && activeCount > 0 && (
              <Button variant="outline" size="sm" onClick={archiveAll} disabled={bulkLoading}>
                <Archive size={13}/> Tout archiver ({activeCount})
              </Button>
            )}
            {showArchived && archivedCount > 0 && (
              <Button variant="outline" size="sm" onClick={restoreAll} disabled={bulkLoading} className="text-green-700 border-green-200 hover:border-green-500">
                <RotateCcw size={13}/> Tout désarchiver ({archivedCount})
              </Button>
            )}
            {bulkLoading && <div className="flex items-center gap-2 text-xs text-gray-400"><Spinner size="sm"/> Traitement…</div>}
          </div>

          {/* Selection bar */}
          <div className={cn('overflow-hidden transition-all duration-200', someSel ? 'max-h-16' : 'max-h-0')}>
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 rounded-2xl">
              <div className="flex items-center gap-2 flex-1">
                <span className="w-6 h-6 bg-white rounded-md flex items-center justify-center text-xs font-black text-gray-900">{selected.size}</span>
                <span className="text-sm font-semibold text-white">produit{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {!showArchived && (
                  <Button size="xs" variant="secondary" onClick={bulkArchive} disabled={bulkLoading}>
                    <Archive size={12}/> Archiver la sélection
                  </Button>
                )}
                {showArchived && (
                  <Button size="xs" onClick={bulkRestore} disabled={bulkLoading} className="bg-green-500 hover:bg-green-600">
                    <RotateCcw size={12}/> Restaurer la sélection
                  </Button>
                )}
                <button onClick={clearSel} className="text-xs text-gray-400 hover:text-white px-2 transition-colors">✕ Désélectionner</button>
              </div>
            </div>
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="w-10 px-4 py-3.5">
                      <button onClick={toggleAll}
                        className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                          allSel ? 'bg-gray-900 border-gray-900' : filtered.some(p => selected.has(p.id)) ? 'bg-gray-300 border-gray-400' : 'border-gray-300 hover:border-gray-500')}>
                        {allSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                        {!allSel && filtered.some(p => selected.has(p.id)) && <div className="w-2.5 h-0.5 bg-gray-600 rounded"/>}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3.5"><SortBtn col="name" label="Produit"/></th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Référence</th>
                    <th className="text-left px-4 py-3.5"><SortBtn col="brand" label="Marque"/></th>
                    <th className="text-right px-4 py-3.5"><SortBtn col="price" label="Prix"/></th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Remise</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Prix final</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={8} className="py-16 text-center"><Spinner size="md" className="mx-auto"/></td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState icon={showArchived ? '🗂' : '📦'}
                        title={showArchived ? 'Aucun produit archivé' : search || filterBrand ? 'Aucun résultat' : 'Aucun produit'}
                        description={!showArchived && !search && !filterBrand ? 'Commencez par ajouter un produit' : undefined}
                        action={!search && !filterBrand && !showArchived ? <Button onClick={openAdd}><Plus size={14}/> Ajouter un produit</Button> : undefined}
                      />
                    </td></tr>
                  ) : paginated.map(p => {
                    const isSel = selected.has(p.id)
                    const isArc = (p as any).is_active === false
                    const img   = (p as any).image_url as string|null
                    return (
                      <tr key={p.id} onClick={() => toggleOne(p.id)}
                        className={cn('cursor-pointer transition-colors group', isSel ? 'bg-gray-900/5' : 'hover:bg-gray-50/60')}>
                        <td className="w-10 px-4 py-4" onClick={e => { e.stopPropagation(); toggleOne(p.id) }}>
                          <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all', isSel ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-500')}>
                            {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl border border-gray-100 bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
                              {img ? <img src={img} alt={p.name} className="w-full h-full object-cover"/> : <ImageIcon size={16} className="text-gray-300"/>}
                            </div>
                            <div>
                              <p className={cn('text-sm font-medium', isArc ? 'text-gray-400' : 'text-gray-900')}>{p.name}</p>
                              {isArc && <Badge variant="secondary" size="sm">Archivé</Badge>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{p.reference}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="info" size="sm">{p.brand?.name}</Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={cn('text-sm', p.discount ? 'text-gray-400 line-through' : 'font-medium text-gray-900')}>{p.price.toFixed(2)} €</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {p.discount ? <Badge variant="destructive" size="sm">-{p.discount}%</Badge> : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-bold text-gray-900">{finalPrice(p).toFixed(2)} €</span>
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isArc ? (
                              <Button size="xs" variant="outline" onClick={() => handleRestoreSingle(p)} className="text-green-700 border-green-200 hover:border-green-500">
                                <RotateCcw size={11}/> Restaurer
                              </Button>
                            ) : (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon-sm" variant="ghost" onClick={() => openEdit(p)}><Pencil size={13}/></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Modifier</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon-sm" variant="ghost" onClick={() => openDelete(p)} className="text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13}/></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Supprimer</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-500">{pageStart}–{pageEnd} sur <span className="font-semibold text-gray-700">{filtered.length}</span>
                    {(search || filterBrand) && <span className="text-gray-400"> (sur {products.length})</span>}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Afficher</span>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      {[50,100,500,1000].map(s => (
                        <button key={s} onClick={() => setPageSize(s)}
                          className={cn('px-2.5 py-1 text-xs font-medium transition-colors', pageSize === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">/ page</span>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage===1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 text-xs">«</button>
                    <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 text-xs">‹</button>
                    {(() => {
                      const pages: (number|'…')[] = []
                      if (totalPages <= 7) for (let i=1;i<=totalPages;i++) pages.push(i)
                      else {
                        pages.push(1)
                        if (currentPage > 3) pages.push('…')
                        for (let i=Math.max(2,currentPage-1);i<=Math.min(totalPages-1,currentPage+1);i++) pages.push(i)
                        if (currentPage < totalPages-2) pages.push('…')
                        pages.push(totalPages)
                      }
                      return pages.map((pg,i) => pg === '…' ? <span key={i} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span> : (
                        <button key={`page-${pg}-${i}`} onClick={() => setCurrentPage(pg as number)}
                          className={cn('w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-all', currentPage === pg ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:border-gray-400')}>
                          {pg}
                        </button>
                      ))
                    })()}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 text-xs">›</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage===totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 text-xs">»</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── MODAL add/edit ── */}
      <Dialog open={modal === 'add' || modal === 'edit'} onOpenChange={o => !o && closeModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modal === 'add' ? 'Ajouter un produit' : 'Modifier le produit'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div><Label>Nom <span className="text-red-400">*</span></Label><Input placeholder="ex. T-shirt oversize" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></div>
              <div><Label>Référence <span className="text-red-400">*</span></Label><Input placeholder="TSH-001" value={form.reference} onChange={e => setForm({...form, reference: e.target.value.toUpperCase()})} className="font-mono uppercase"/></div>
              <div>
                <Label>Marque <span className="text-red-400">*</span></Label>
                <div className="flex gap-2">
                  <Select value={form.brand_id} onValueChange={v => setForm({...form, brand_id: v})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Choisir une marque"/></SelectTrigger>
                    <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="md" onClick={() => setModal('brand')}><Plus size={14}/> Marque</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prix (€) <span className="text-red-400">*</span></Label>
                  <Input type="number" placeholder="0.00" min="0" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})}/>
                </div>
                <div>
                  <Label>Remise (%)</Label>
                  <Input type="number" placeholder="0" min="0" max="100" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})}/>
                </div>
              </div>
              {form.price && Number(form.price) > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Prix affiché en caisse</span>
                  <div className="flex items-baseline gap-2">
                    {Number(form.discount) > 0 && <span className="text-sm text-gray-400 line-through">{Number(form.price).toFixed(2)} €</span>}
                    <span className="text-lg font-black text-gray-900">{(Number(form.price)*(1-(Number(form.discount)||0)/100)).toFixed(2)} €</span>
                  </div>
                </div>
              )}
              <ProductImageUpload currentUrl={form.image_url} onUpload={handleImageUpload} onRemove={handleImageRemove} uploading={imageUploading}/>
              {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || imageUploading}>
              {saving ? <><Spinner size="sm"/> Enregistrement…</> : modal === 'add' ? 'Ajouter le produit' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL delete ── */}
      <Dialog open={modal === 'delete' && !!deleteTarget} onOpenChange={o => !o && closeModal()}>
        <DialogContent className="max-w-md">
          {deleteMode === 'linked' ? (
            <>
              <DialogHeader><DialogTitle>Impossible de supprimer</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
                  <p className="text-sm text-gray-500"><span className="font-semibold text-gray-800">{deleteTarget?.name}</span> est associé à des ventes passées.</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                    <p className="text-xs font-bold text-amber-800 mb-1">💡 Solution : Archiver</p>
                    <p className="text-xs text-amber-700">Le produit n'apparaîtra plus en caisse mais l'historique reste intact.</p>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl mt-4">{error}</p>}
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={closeModal} disabled={saving}>Annuler</Button>
                <Button onClick={handleArchiveSingle} disabled={saving}>
                  {saving ? <Spinner size="sm"/> : <><Archive size={14}/> Archiver le produit</>}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>Supprimer ce produit ?</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto"><Trash2 size={24} className="text-red-500"/></div>
                  <p className="text-sm text-gray-500"><span className="font-semibold text-gray-800">{deleteTarget?.name}</span> sera définitivement supprimé. Cette action est irréversible.</p>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl mt-4">{error}</p>}
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={closeModal} disabled={saving}>Annuler</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                  {saving ? <Spinner size="sm"/> : 'Supprimer'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL nouvelle marque ── */}
      <Dialog open={modal === 'brand'} onOpenChange={o => !o && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouvelle marque</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div><Label>Nom de la marque <span className="text-red-400">*</span></Label>
                <Input placeholder="ex. Jacquemus" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateBrand()} autoFocus/>
              </div>
              {brands.length > 0 && (
                <div><p className="text-xs text-gray-400 mb-2">Marques existantes</p>
                  <div className="flex flex-wrap gap-2">{brands.map(b => <Badge key={b.id} variant="secondary">{b.name}</Badge>)}</div>
                </div>
              )}
              {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Annuler</Button>
            <Button onClick={handleCreateBrand} disabled={!newBrandName.trim() || saving}>
              {saving ? <Spinner size="sm"/> : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
