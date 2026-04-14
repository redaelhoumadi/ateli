'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getProducts,
  getBrands,
  createProduct,
  updateProduct,
  deleteProduct,
  archiveProduct,
  restoreProduct,
  createBrand,
} from '@/lib/supabase'
import type { Product, Brand } from '@/types'

type ProductForm = {
  name: string
  reference: string
  price: string
  discount: string
  brand_id: string
}

const emptyForm: ProductForm = { name: '', reference: '', price: '', discount: '', brand_id: '' }

export default function ProduitsPage() {
  const [products, setProducts]       = useState<Product[]>([])
  const [brands, setBrands]           = useState<Brand[]>([])
  const [loading, setLoading]         = useState(true)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [search, setSearch]           = useState('')
  const [filterBrand, setFilterBrand] = useState<string>('')
  const [showArchived, setShowArchived] = useState(false)

  // Selection
  const [selected, setSelected]   = useState<Set<string>>(new Set())

  // Modals
  const [modal, setModal]               = useState<'add' | 'edit' | 'delete' | 'brand' | null>(null)
  const [editTarget, setEditTarget]     = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteMode, setDeleteMode]     = useState<'confirm' | 'linked' | null>(null)
  const [form, setForm]                 = useState<ProductForm>(emptyForm)
  const [newBrandName, setNewBrandName] = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  // ── Pagination ────────────────────────────────────────────
  const [pageSize, setPageSize]   = useState<number>(50)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [search, filterBrand, showArchived, pageSize])

  // ── Load ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b] = await Promise.all([getProducts(), getBrands()])
      setProducts((p as Product[]) || [])
      setBrands((b as Brand[]) || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Filtering ──────────────────────────────────────────────
  const filtered = useMemo(() => products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.name?.toLowerCase().includes(search.toLowerCase())
    const matchBrand  = !filterBrand || p.brand_id === filterBrand
    const matchActive = showArchived
      ? (p as any).is_active === false
      : (p as any).is_active !== false
    return matchSearch && matchBrand && matchActive
  }), [products, search, filterBrand, showArchived])

  // ── Pagination computed ───────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated   = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageStart   = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd     = Math.min(currentPage * pageSize, filtered.length)

  // ── Selection helpers ─────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const someSelected        = selected.size > 0

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  const clearSelection = () => setSelected(new Set())

  // ── Bulk operations ───────────────────────────────────────
  const bulkArchive = async () => {
    const ids = [...selected]
    setBulkLoading(true)
    try {
      await Promise.all(ids.map((id) => archiveProduct(id)))
      setProducts((prev) =>
        prev.map((p) => selected.has(p.id) ? { ...p, is_active: false } : p)
      )
      clearSelection()
    } catch (e: any) {
      alert(e.message || 'Erreur lors de l\'archivage en masse')
    } finally {
      setBulkLoading(false)
    }
  }

  const bulkRestore = async () => {
    const ids = [...selected]
    setBulkLoading(true)
    try {
      await Promise.all(ids.map((id) => restoreProduct(id)))
      setProducts((prev) =>
        prev.map((p) => selected.has(p.id) ? { ...p, is_active: true } : p)
      )
      clearSelection()
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la restauration en masse')
    } finally {
      setBulkLoading(false)
    }
  }

  const archiveAll = async () => {
    if (!confirm(`Archiver tous les produits actifs (${activeCount}) ?`)) return
    setBulkLoading(true)
    try {
      const ids = products
        .filter((p) => (p as any).is_active !== false)
        .map((p) => p.id)
      await Promise.all(ids.map((id) => archiveProduct(id)))
      setProducts((prev) => prev.map((p) => ({ ...p, is_active: false })))
      clearSelection()
    } catch (e: any) {
      alert(e.message || 'Erreur')
    } finally {
      setBulkLoading(false)
    }
  }

  const restoreAll = async () => {
    if (!confirm(`Restaurer tous les produits archivés (${archivedCount}) ?`)) return
    setBulkLoading(true)
    try {
      const ids = products
        .filter((p) => (p as any).is_active === false)
        .map((p) => p.id)
      await Promise.all(ids.map((id) => restoreProduct(id)))
      setProducts((prev) => prev.map((p) => ({ ...p, is_active: true })))
      clearSelection()
    } catch (e: any) {
      alert(e.message || 'Erreur')
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Single CRUD ───────────────────────────────────────────
  const openAdd = () => {
    setForm({ ...emptyForm, brand_id: brands[0]?.id || '' })
    setError('')
    setModal('add')
  }

  const openEdit = (p: Product) => {
    setEditTarget(p)
    setForm({
      name: p.name, reference: p.reference,
      price: String(p.price),
      discount: p.discount !== null ? String(p.discount) : '',
      brand_id: p.brand_id,
    })
    setError('')
    setModal('edit')
  }

  const openDelete = (p: Product) => {
    setDeleteTarget(p)
    setDeleteMode(null)
    setError('')
    setModal('delete')
  }

  const closeModal = () => {
    setModal(null)
    setEditTarget(null)
    setDeleteTarget(null)
    setError('')
  }

  const handleSave = async () => {
    if (!form.name.trim())    return setError('Le nom est obligatoire')
    if (!form.reference.trim()) return setError('La référence est obligatoire')
    if (!form.price || isNaN(Number(form.price))) return setError('Prix invalide')
    if (!form.brand_id)       return setError('Sélectionnez une marque')

    const discountVal =
      form.discount !== '' && !isNaN(Number(form.discount)) ? Number(form.discount) : null

    if (discountVal !== null && (discountVal < 0 || discountVal > 100))
      return setError('La remise doit être entre 0 et 100 %')

    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name.trim(),
        reference: form.reference.trim().toUpperCase(),
        price: Number(form.price),
        discount: discountVal,
        brand_id: form.brand_id,
      }
      if (modal === 'add') {
        const created = await createProduct(payload)
        setProducts((prev) => [...prev, created as Product].sort((a, b) => a.name.localeCompare(b.name)))
      } else if (modal === 'edit' && editTarget) {
        const updated = await updateProduct(editTarget.id, payload)
        setProducts((prev) => prev.map((p) => p.id === editTarget.id ? (updated as Product) : p))
      }
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true); setError('')
    try {
      await deleteProduct(deleteTarget.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      closeModal()
    } catch (err: any) {
      if (err.message === 'LINKED') setDeleteMode('linked')
      else setError(err.message || 'Impossible de supprimer ce produit')
    } finally {
      setSaving(false)
    }
  }

  const handleArchiveSingle = async () => {
    if (!deleteTarget) return
    setSaving(true); setError('')
    try {
      await archiveProduct(deleteTarget.id)
      setProducts((prev) => prev.map((p) => p.id === deleteTarget.id ? { ...p, is_active: false } : p))
      closeModal()
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'archivage")
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreSingle = async (p: Product) => {
    try {
      await restoreProduct(p.id)
      setProducts((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, is_active: true } : pr))
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la restauration')
    }
  }

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return
    setSaving(true)
    try {
      const b = await createBrand(newBrandName.trim())
      setBrands((prev) => [...prev, b as Brand].sort((a, z) => a.name.localeCompare(z.name)))
      setForm((f) => ({ ...f, brand_id: (b as Brand).id }))
      setNewBrandName('')
      setModal(modal === 'brand' ? null : modal)
    } catch (err: any) {
      setError(err.message || 'Erreur création marque')
    } finally {
      setSaving(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────
  const activeCount   = products.filter((p) => (p as any).is_active !== false).length
  const archivedCount = products.filter((p) => (p as any).is_active === false).length
  const avgPrice      = activeCount ? products.filter((p) => (p as any).is_active !== false).reduce((s, p) => s + p.price, 0) / activeCount : 0
  const withDiscount  = products.filter((p) => p.discount && p.discount > 0 && (p as any).is_active !== false).length
  const finalPrice    = (p: Product) => p.discount ? p.price * (1 - p.discount / 100) : p.price

  // Selected products details (for bulk bar label)
  const selectedProducts = filtered.filter((p) => selected.has(p.id))
  const selectedAllActive   = selectedProducts.every((p) => (p as any).is_active !== false)
  const selectedAllArchived = selectedProducts.every((p) => (p as any).is_active === false)
  const selectedMixed       = !selectedAllActive && !selectedAllArchived

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-6 py-8">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1 text-sm">
              <a href="/pos" className="text-gray-400 hover:text-gray-600 transition-colors">← POS</a>
              <span className="text-gray-300">/</span>
              <span className="text-gray-600">Produits</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Catalogue produits</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gérez vos produits et vos marques</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setNewBrandName(''); setError(''); setModal('brand') }}
              className="px-4 py-2.5 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 transition-all"
            >
              🏷 Nouvelle marque
            </button>
            <button
              onClick={openAdd}
              className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              + Ajouter un produit
            </button>
          </div>
        </div>

        {/* ── KPIs ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Produits actifs',  value: activeCount,                       icon: '📦' },
            { label: 'Archivés',         value: archivedCount,                     icon: '🗂' },
            { label: 'Prix moyen',       value: `${avgPrice.toFixed(2)} €`,        icon: '💶' },
            { label: 'En promotion',     value: withDiscount,                      icon: '🏷️' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{k.label}</p>
                <span className="text-lg">{k.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>

        {/* ── Search + filters ────────────────────────────── */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Rechercher par nom, référence ou marque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black min-w-[160px]"
          >
            <option value="">Toutes les marques</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            onClick={() => { setShowArchived(!showArchived); clearSelection() }}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
              showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {showArchived ? '📦 Archivés' : '🗂 Voir archivés'}
          </button>
        </div>

        {/* ── Global bulk actions (Tout archiver / Tout désarchiver) ── */}
        <div className="flex items-center gap-3 mb-4">
          {!showArchived && activeCount > 0 && (
            <button
              onClick={archiveAll}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-800 hover:text-gray-900 disabled:opacity-50 transition-all"
            >
              <span>📦</span>
              Tout archiver ({activeCount})
            </button>
          )}
          {showArchived && archivedCount > 0 && (
            <button
              onClick={restoreAll}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl hover:border-green-500 disabled:opacity-50 transition-all"
            >
              <span>↩</span>
              Tout désarchiver ({archivedCount})
            </button>
          )}
          {bulkLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              Traitement en cours…
            </div>
          )}
        </div>

        {/* ── Selection bulk action bar ────────────────────── */}
        <div className={`overflow-hidden transition-all duration-200 ${someSelected ? 'max-h-20 mb-4' : 'max-h-0 mb-0'}`}>
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 rounded-2xl">
            {/* Count */}
            <div className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                <span className="text-xs font-black text-gray-900">{selected.size}</span>
              </div>
              <span className="text-sm font-semibold text-white">
                produit{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              {/* Archive selected (only if viewing active) */}
              {!showArchived && (selectedAllActive || selectedMixed) && (
                <button
                  onClick={bulkArchive}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-900 bg-white rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-all"
                >
                  📦 Archiver la sélection
                </button>
              )}
              {/* Restore selected (only if viewing archived) */}
              {showArchived && (selectedAllArchived || selectedMixed) && (
                <button
                  onClick={bulkRestore}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-900 bg-green-400 rounded-xl hover:bg-green-300 disabled:opacity-50 transition-all"
                >
                  ↩ Restaurer la sélection
                </button>
              )}
              {/* Deselect */}
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-xl transition-colors"
              >
                ✕ Désélectionner
              </button>
            </div>
          </div>
        </div>

        {/* ── Products table ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {/* Checkbox header */}
                <th className="w-12 px-4 py-3.5">
                  <button
                    onClick={toggleAll}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      allFilteredSelected
                        ? 'bg-gray-900 border-gray-900'
                        : filtered.some((p) => selected.has(p.id))
                        ? 'bg-gray-300 border-gray-400'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {allFilteredSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    )}
                    {!allFilteredSelected && filtered.some((p) => selected.has(p.id)) && (
                      <div className="w-2.5 h-0.5 bg-gray-600 rounded" />
                    )}
                  </button>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Produit</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Référence</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Marque</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Prix</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Remise</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Prix final</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3.5 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <p className="text-4xl mb-3">{showArchived ? '🗂' : '📦'}</p>
                    <p className="text-gray-400 text-sm">
                      {showArchived
                        ? 'Aucun produit archivé'
                        : search || filterBrand
                        ? 'Aucun produit correspond à votre recherche'
                        : 'Aucun produit — commencez par en ajouter un'}
                    </p>
                    {!search && !filterBrand && !showArchived && (
                      <button onClick={openAdd} className="mt-4 px-5 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
                        + Ajouter un produit
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const isSelected  = selected.has(p.id)
                  const isArchived  = (p as any).is_active === false
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleOne(p.id)}
                      className={`border-b border-gray-50 last:border-0 cursor-pointer transition-colors group ${
                        isSelected ? 'bg-gray-900/5' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-4" onClick={(e) => { e.stopPropagation(); toggleOne(p.id) }}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-500'
                        }`}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${isArchived ? 'text-gray-400' : 'text-gray-900'}`}>{p.name}</p>
                          {isArchived && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Archivé</span>
                          )}
                        </div>
                      </td>

                      {/* Reference */}
                      <td className="px-4 py-4">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{p.reference}</span>
                      </td>

                      {/* Brand */}
                      <td className="px-4 py-4">
                        <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full border border-blue-100">{p.brand?.name}</span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4 text-right">
                        <span className={`text-sm ${p.discount ? 'text-gray-400 line-through' : 'font-medium text-gray-900'}`}>
                          {p.price.toFixed(2)} €
                        </span>
                      </td>

                      {/* Discount */}
                      <td className="px-4 py-4 text-right">
                        {p.discount ? (
                          <span className="text-xs bg-red-50 text-red-600 font-semibold px-2.5 py-1 rounded-full border border-red-100">-{p.discount} %</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Final price */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-bold text-gray-900">{finalPrice(p).toFixed(2)} €</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isArchived ? (
                            <button
                              onClick={() => handleRestoreSingle(p)}
                              className="text-xs px-3 py-1.5 border border-green-200 text-green-600 rounded-lg hover:bg-green-50 transition-all whitespace-nowrap"
                            >
                              ↩ Restaurer
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => openEdit(p)}
                                className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:border-black hover:text-black transition-all"
                              >
                                ✏️ Modifier
                              </button>
                              <button
                                onClick={() => openDelete(p)}
                                className="text-xs px-3 py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-all"
                              >
                                🗑 Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Footer — pagination ────────────────────────────── */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">

              {/* Left: count + per-page selector */}
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">
                  {pageStart}–{pageEnd} sur{' '}
                  <span className="font-semibold text-gray-700">{filtered.length}</span>
                  {(search || filterBrand) && (
                    <span className="text-gray-400"> (filtrés sur {products.length})</span>
                  )}
                  {someSelected && (
                    <span className="text-gray-500 ml-2">· {selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
                  )}
                </p>

                {/* Per-page selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Afficher</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {[50, 100, 500, 1000].map((size) => (
                      <button
                        key={size}
                        onClick={() => setPageSize(size)}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          pageSize === size
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">/ page</span>
                </div>
              </div>

              {/* Right: page navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  {/* First */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
                    title="Première page"
                  >
                    «
                  </button>
                  {/* Prev */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
                  >
                    ‹
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages: (number | '…')[] = []
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i)
                      } else {
                        pages.push(1)
                        if (currentPage > 3) pages.push('…')
                        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                          pages.push(i)
                        }
                        if (currentPage < totalPages - 2) pages.push('…')
                        pages.push(totalPages)
                      }
                      return pages.map((page, i) =>
                        page === '…' ? (
                          <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page as number)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                              currentPage === page
                                ? 'bg-gray-900 text-white border border-gray-900'
                                : 'border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )
                    })()}
                  </div>

                  {/* Next */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
                  >
                    ›
                  </button>
                  {/* Last */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
                    title="Dernière page"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          MODAL — Ajouter / Modifier
      ════════════════════════════════════════════════════ */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{modal === 'add' ? 'Ajouter un produit' : 'Modifier le produit'}</h2>
                {modal === 'edit' && editTarget && <p className="text-sm text-gray-400 mt-0.5">{editTarget.name}</p>}
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom du produit <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. T-shirt oversize coton bio" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Référence <span className="text-red-400">*</span></label>
                <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })} placeholder="ex. TSH-001" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Marque <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    <option value="">Sélectionner une marque</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button onClick={() => setModal('brand')} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-black transition-colors whitespace-nowrap">+ Marque</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Prix (€) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" min="0" step="0.01" className="w-full border border-gray-200 rounded-xl pl-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Remise (%) <span className="text-gray-400 font-normal">– optionnel</span></label>
                  <div className="relative">
                    <input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" min="0" max="100" step="1" className="w-full border border-gray-200 rounded-xl pl-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>
              {form.price && Number(form.price) > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Prix affiché en caisse</span>
                  <div className="flex items-baseline gap-2">
                    {form.discount && Number(form.discount) > 0 && (
                      <span className="text-sm text-gray-400 line-through">{Number(form.price).toFixed(2)} €</span>
                    )}
                    <span className="text-lg font-bold text-gray-900">
                      {(Number(form.price) * (1 - (form.discount && Number(form.discount) > 0 ? Number(form.discount) : 0) / 100)).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={closeModal} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-[2] py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement...' : modal === 'add' ? '+ Ajouter le produit' : '✓ Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — Supprimer
      ════════════════════════════════════════════════════ */}
      {modal === 'delete' && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            {deleteMode === 'linked' ? (
              <>
                <div className="text-center mb-5">
                  <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-2xl">⚠️</span></div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Impossible de supprimer</h2>
                  <p className="text-sm text-gray-500 mb-4"><span className="font-semibold text-gray-800">{deleteTarget.name}</span> est associé à des ventes passées. La suppression briserait l'historique.</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                    <p className="text-xs font-bold text-amber-800 mb-1">💡 Solution recommandée : Archiver</p>
                    <p className="text-xs text-amber-700">Le produit n'apparaîtra plus en caisse, mais l'historique reste intact.</p>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl mb-4 text-center">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={closeModal} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
                  <button onClick={handleArchiveSingle} disabled={saving} className="flex-[2] py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-black disabled:opacity-50">
                    {saving ? 'Archivage...' : '📦 Archiver le produit'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-2xl">🗑</span></div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Supprimer ce produit ?</h2>
                  <p className="text-sm text-gray-500"><span className="font-medium text-gray-700">{deleteTarget.name}</span> sera définitivement supprimé. Cette action est irréversible.</p>
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl mb-4 text-center">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={closeModal} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
                  <button onClick={handleDelete} disabled={saving} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
                    {saving ? 'Vérification...' : 'Oui, supprimer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — Nouvelle marque
      ════════════════════════════════════════════════════ */}
      {modal === 'brand' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle marque</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom de la marque <span className="text-red-400">*</span></label>
                <input type="text" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateBrand()} placeholder="ex. Jacquemus, Ami Paris..." autoFocus className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              {brands.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Marques existantes</p>
                  <div className="flex flex-wrap gap-2">
                    {brands.map((b) => (
                      <span key={b.id} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{b.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
                <button onClick={handleCreateBrand} disabled={!newBrandName.trim() || saving} className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40">
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
