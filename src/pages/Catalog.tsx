import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useUIStore } from '@/store'
import { uploadImage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from '@/hooks/useCatalog'
import type { ReasonCatalogItem, ReasonVariant, ReasonType } from '@/types'
import { cn } from '@/lib/utils'

// Traduction des types pour affichage dans l'UI
const TYPE_LABELS: Record<ReasonType, string> = {
  biais: 'Biais',
  poi: 'POI / Zone',
  entry: 'Entrée',
  sl: 'Stop Loss (SL)',
  tp: 'Take Profit (TP)',
  trailing: 'Trailing Stop',
  confirmation: 'Confirmation',
}

// Couleurs des badges par type
const TYPE_COLORS: Record<ReasonType, string> = {
  biais: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  poi: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  entry: 'bg-accent/10 text-accent border-accent/20',
  sl: 'bg-loss/10 text-loss border-loss/20',
  tp: 'bg-win/10 text-win border-win/20',
  trailing: 'bg-be/10 text-be border-be/20',
  confirmation: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
}

export default function Catalog() {
  const { data: catalogItems, isLoading } = useCatalog()
  const { mutateAsync: createItem } = useCreateCatalogItem()
  const { mutateAsync: updateItem } = useUpdateCatalogItem()
  const { mutateAsync: deleteItem } = useDeleteCatalogItem()
  const addToast = useUIStore((state) => state.addToast)

  // Filtres et recherche
  const [selectedType, setSelectedType] = useState<ReasonType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals et États d'édition
  const [viewingItem, setViewingItem] = useState<ReasonCatalogItem | null>(null)
  const [editingItem, setEditingItem] = useState<ReasonCatalogItem | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // État du formulaire en cours d'édition/création
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<ReasonType>('entry')
  const [formVariants, setFormVariants] = useState<Omit<ReasonVariant, 'id' | 'reason_id' | 'created_at'>[]>([])
  const [saving, setSaving] = useState(false)

  // États pour l'upload d'images dans le formulaire
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  // Ouvre le formulaire en mode Création
  const handleOpenCreate = () => {
    setEditingItem(null)
    setFormTitle('')
    setFormDescription('')
    setFormType('entry')
    setFormVariants([{ name: 'Standard', image_url: '', notes: '' }])
    setIsFormOpen(true)
  }

  // Ouvre le formulaire en mode Édition
  const handleOpenEdit = (item: ReasonCatalogItem) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDescription(item.description || '')
    setFormType(item.type)
    setFormVariants(
      item.variants.map((v) => ({
        name: v.name,
        image_url: v.image_url || '',
        notes: v.notes || '',
      }))
    )
    setIsFormOpen(true)
  }

  // Ajoute une variante vide dans le formulaire
  const handleAddFormVariant = () => {
    setFormVariants((prev) => [...prev, { name: '', image_url: '', notes: '' }])
  }

  // Retire une variante du formulaire
  const handleRemoveFormVariant = (index: number) => {
    setFormVariants((prev) => prev.filter((_, i) => i !== index))
  }

  // Met à jour un champ d'une variante spécifique du formulaire
  const handleUpdateFormVariant = (index: number, key: 'name' | 'image_url' | 'notes', val: string) => {
    setFormVariants((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [key]: val }
      return copy
    })
  }

  // Gère l'upload de l'image pour une variante
  const handleUploadImage = async (index: number, file: File) => {
    if (!file) return
    setUploadingIndex(index)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      // Création du chemin d'image dans le storage
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
      const path = `catalog/${user.id}/${Date.now()}-${cleanFileName}`
      
      const publicUrl = await uploadImage(file, path)
      handleUpdateFormVariant(index, 'image_url', publicUrl)
      addToast('Image importée !', 'success')
    } catch (e) {
      console.error(e)
      addToast('Erreur lors de l\'upload de l\'image', 'error')
    } finally {
      setUploadingIndex(null)
    }
  }

  // Action de sauvegarde (Création ou Édition)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      addToast('Le titre est requis', 'error')
      return
    }

    setSaving(true)
    try {
      const itemData = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        type: formType,
      }

      // Nettoie les variantes : on ignore celles sans nom
      const validVariants = formVariants
        .filter((v) => v.name.trim() !== '')
        .map((v) => ({
          name: v.name.trim(),
          image_url: v.image_url?.trim() || null,
          notes: v.notes?.trim() || null,
        }))

      if (editingItem) {
        await updateItem({
          id: editingItem.id,
          item: itemData,
          variants: validVariants,
        })
        addToast('Concept technique modifié !', 'success')
      } else {
        await createItem({
          item: itemData,
          variants: validVariants,
        })
        addToast('Concept technique ajouté au catalogue !', 'success')
      }
      setIsFormOpen(false)
    } catch (e) {
      console.error(e)
      addToast('Erreur lors de la sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Suppression d'un item du catalogue
  const handleDelete = async (id: string) => {
    if (confirm('Es-tu sûr de vouloir supprimer ce concept technique ?')) {
      try {
        await deleteItem(id)
        addToast('Concept supprimé du catalogue', 'success')
        // Si on était en train de le visualiser, on le ferme
        if (viewingItem?.id === id) setViewingItem(null)
      } catch (e) {
        console.error(e)
        addToast('Erreur lors de la suppression', 'error')
      }
    }
  }

  // Filtrage des éléments selon la recherche et le type
  const itemsFiltrés = catalogItems?.filter((item) => {
    const matchType = selectedType === 'all' || item.type === selectedType
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchType && matchSearch
  })

  return (
    <AppLayout title="Catalogue de Raisons">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Bandeau d'intro premium */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-txt tracking-tight">Source de Vérité Technique</h1>
            <p className="text-txt3 text-xs mt-1 max-w-xl">
              Consigne ici toutes les raisons et patterns qui justifient tes mouvements (Entrées, SL, TP, Trailing). Ajoute des photos de référence pour assurer la constance de ton plan de trading.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-md text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5 self-start md:self-auto"
          >
            <span>+</span> Nouveau Concept
          </button>
        </div>

        {/* Barre de Filtres et Recherche */}
        <div className="flex flex-col gap-3.5 bg-surface/50 border border-border/80 rounded-xl p-4">
          <input
            type="text"
            placeholder="Rechercher un concept technique (ex: Wyckoff)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border2 rounded-lg text-txt px-3.5 py-2 text-xs outline-none focus:border-accent transition-colors"
          />

          {/* Onglets horizontaux pour filtrer par type */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedType('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                selectedType === 'all'
                  ? 'bg-accent/10 border-accent/25 text-accent font-semibold'
                  : 'bg-transparent border-transparent text-txt2 hover:bg-surface2 hover:text-txt'
              )}
            >
              Tous ({catalogItems?.length || 0})
            </button>
            {(Object.keys(TYPE_LABELS) as ReasonType[]).map((t) => {
              const count = catalogItems?.filter((x) => x.type === t).length || 0
              return (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                    selectedType === t
                      ? 'bg-accent/10 border-accent/25 text-accent font-semibold'
                      : 'bg-transparent border-transparent text-txt2 hover:bg-surface2 hover:text-txt'
                  )}
                >
                  {TYPE_LABELS[t]} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Chargement */}
        {isLoading && (
          <div className="py-20 flex justify-center text-txt3 text-xs animate-pulse">
            Chargement de la source de vérité...
          </div>
        )}

        {/* Liste des concepts */}
        {!isLoading && itemsFiltrés && itemsFiltrés.length === 0 && (
          <div className="py-20 text-center border border-dashed border-border2 rounded-2xl">
            <p className="text-txt3 text-xs">Aucun concept technique trouvé dans cette catégorie.</p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-surface2 border border-border2 hover:text-txt text-txt2 rounded-md text-xs font-medium transition-all"
            >
              Créer ton premier concept
            </button>
          </div>
        )}

        {!isLoading && itemsFiltrés && itemsFiltrés.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemsFiltrés.map((item) => (
              <div
                key={item.id}
                onClick={() => setViewingItem(item)}
                className="group relative bg-surface border border-border rounded-xl p-5 hover:border-accent/30 hover:scale-[1.01] transition-all duration-300 cursor-pointer shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* Badge de type */}
                  <div className="flex items-center justify-between mb-3.5">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border',
                        TYPE_COLORS[item.type]
                      )}
                    >
                      {TYPE_LABELS[item.type]}
                    </span>
                    <span className="text-[10px] text-txt3 font-medium">
                      {item.variants.length} variante{item.variants.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Titre & description */}
                  <h3 className="text-[14px] font-semibold text-txt group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-txt2 text-xs mt-2 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Footer de la carte (miniatures ou boutons rapides) */}
                <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
                  {/* Mini-aperçus des images de variantes */}
                  <div className="flex -space-x-2.5 overflow-hidden">
                    {item.variants
                      .filter((v) => v.image_url)
                      .slice(0, 3)
                      .map((v, i) => (
                        <img
                          key={i}
                          src={v.image_url || ''}
                          alt={v.name}
                          className="inline-block h-6 w-6 rounded-full ring-2 ring-surface object-cover bg-surface2"
                        />
                      ))}
                  </div>

                  {/* Actions (discrètes au survol) */}
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEdit(item)
                      }}
                      title="Modifier"
                      className="p-1.5 hover:bg-surface2 rounded text-txt2 hover:text-txt transition-colors text-xs"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item.id)
                      }}
                      title="Supprimer"
                      className="p-1.5 hover:bg-loss/10 rounded text-txt3 hover:text-loss transition-colors text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── MODAL DE DÉTAIL / VISUALISATION DE CONCEPT ────────────────── */}
        {viewingItem && (
          <ItemDetailModal
            item={viewingItem}
            onClose={() => setViewingItem(null)}
            onEdit={() => {
              const itemToEdit = viewingItem
              setViewingItem(null)
              handleOpenEdit(itemToEdit)
            }}
          />
        )}

        {/* ─── DRAWER / MODAL DE FORMULAIRE (CRÉATION ET ÉDITION) ───────── */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
            <div className="bg-surface border border-border w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-slideUp">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-txt">
                  {editingItem ? 'Modifier le Concept Technique' : 'Ajouter un Concept Technique'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-txt3 hover:text-txt text-base transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Champs généraux */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-txt3 text-[10px] font-semibold uppercase tracking-wider">
                      Titre
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Wyckoff candle, BOS H4..."
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="bg-bg border border-border2 rounded-lg text-txt px-3 py-2 text-xs outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-txt3 text-[10px] font-semibold uppercase tracking-wider">
                      Type de contexte
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as ReasonType)}
                      className="bg-bg border border-border2 rounded-lg text-txt px-3 py-2 text-xs outline-none focus:border-accent"
                    >
                      {(Object.keys(TYPE_LABELS) as ReasonType[]).map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-txt3 text-[10px] font-semibold uppercase tracking-wider">
                    Description générale
                  </label>
                  <textarea
                    placeholder="Qu'est-ce que ce concept ? Comment s'applique-t-il dans ton plan ?"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="bg-bg border border-border2 rounded-lg text-txt px-3 py-2 text-xs outline-none focus:border-accent min-h-[60px] resize-y"
                  />
                </div>

                {/* Gestion des Variantes */}
                <div className="pt-4 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-txt">Variantes / Niveaux d'intensité</h3>
                    <button
                      type="button"
                      onClick={handleAddFormVariant}
                      className="px-2.5 py-1 bg-surface2 border border-border2 hover:border-accent text-txt2 hover:text-txt rounded text-[11px] font-medium transition-colors"
                    >
                      + Ajouter une variante
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formVariants.map((variant, index) => (
                      <div
                        key={index}
                        className="bg-bg/40 border border-border2/60 rounded-xl p-4 relative space-y-3"
                      >
                        {/* Bouton de suppression de variante */}
                        {formVariants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFormVariant(index)}
                            className="absolute top-2.5 right-3 text-txt3 hover:text-loss text-xs transition-colors"
                            title="Supprimer cette variante"
                          >
                            Supprimer
                          </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Nom de la variante */}
                          <div className="flex flex-col gap-1">
                            <label className="text-txt3 text-[9px] font-semibold uppercase tracking-wider">
                              Nom de la variante
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Mineur, Moyen, Majeur..."
                              value={variant.name}
                              onChange={(e) => handleUpdateFormVariant(index, 'name', e.target.value)}
                              className="bg-bg border border-border2 rounded-md text-txt px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                            />
                          </div>

                          {/* Notes/description de la variante */}
                          <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-txt3 text-[9px] font-semibold uppercase tracking-wider">
                              Notes explicatives
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Quand la mèche prend 50% du corps..."
                              value={variant.notes || ''}
                              onChange={(e) => handleUpdateFormVariant(index, 'notes', e.target.value)}
                              className="bg-bg border border-border2 rounded-md text-txt px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        {/* Image de référence (URL ou Fichier) */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-txt3 text-[9px] font-semibold uppercase tracking-wider">
                            Photo de référence
                          </label>

                          <div className="flex flex-col sm:flex-row gap-2.5 items-start">
                            {/* Option 1 : Coller un lien */}
                            <input
                              type="url"
                              placeholder="Lien de l'image (TradingView, Imgur...)"
                              value={variant.image_url || ''}
                              onChange={(e) => handleUpdateFormVariant(index, 'image_url', e.target.value)}
                              className="w-full sm:flex-1 bg-bg border border-border2 rounded-md text-txt px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                            />

                            {/* Séparateur/Bouton d'upload */}
                            <div className="flex items-center gap-2">
                              <span className="text-txt3 text-[10px] hidden sm:inline">ou</span>
                              <input
                                type="file"
                                id={`file-upload-${index}`}
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUploadImage(index, file)
                                }}
                              />
                              <label
                                htmlFor={`file-upload-${index}`}
                                className={cn(
                                  'px-3 py-1.5 bg-surface2 border border-border2 hover:text-txt rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap block text-center',
                                  uploadingIndex === index && 'opacity-50 pointer-events-none'
                                )}
                              >
                                {uploadingIndex === index ? 'Upload en cours...' : '🖼️ Téléverser'}
                              </label>
                            </div>
                          </div>

                          {/* Aperçu de l'image si présente */}
                          {variant.image_url && (
                            <div className="relative w-full max-h-28 rounded-lg overflow-hidden border border-border mt-1">
                              <img
                                src={variant.image_url}
                                alt="Aperçu"
                                className="w-full h-28 object-cover object-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFormVariant(index, 'image_url', '')}
                                className="absolute top-1.5 right-2 bg-black/70 hover:bg-black text-white hover:text-loss rounded-full w-5 h-5 flex items-center justify-center text-[10px] transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>

              {/* Barre d'actions du formulaire */}
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-border2 hover:bg-surface2 text-txt2 hover:text-txt text-xs font-semibold rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde...' : editingItem ? 'Sauvegarder les modifications' : 'Enregistrer le concept'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// ─── COMPOSANT LOCAL : MODAL DE DÉTAIL PREMIUM AVEC CAROUSEL/TABS ───────

interface ItemDetailModalProps {
  item: ReasonCatalogItem
  onClose: () => void
  onEdit: () => void
}

function ItemDetailModal({ item, onClose, onEdit }: ItemDetailModalProps) {
  // Index de la variante sélectionnée
  const [activeVariantIndex, setActiveVariantIndex] = useState(0)
  const activeVariant = item.variants[activeVariantIndex]

  // Agrandissement plein écran de l'image (lightbox)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/85 z-[180] flex items-center justify-center p-4">
      {/* Container principal */}
      <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-slideUp relative">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border',
                TYPE_COLORS[item.type]
              )}
            >
              {TYPE_LABELS[item.type]}
            </span>
            <h2 className="text-sm font-semibold text-txt">{item.title}</h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onEdit}
              className="px-2.5 py-1 bg-surface2 border border-border2 hover:text-txt text-txt2 rounded text-[11px] font-medium transition-colors"
            >
              Modifier
            </button>
            <button
              onClick={onClose}
              className="text-txt3 hover:text-txt text-lg leading-none p-1 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Corps du modal */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col md:flex-row gap-5">
          {/* Section gauche : détails et sélecteur de variantes */}
          <div className="flex-1 space-y-4">
            {item.description && (
              <div>
                <h4 className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1">
                  Description
                </h4>
                <p className="text-txt2 text-xs leading-relaxed">{item.description}</p>
              </div>
            )}

            {/* Onglets des variantes */}
            {item.variants.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-txt3 uppercase tracking-wider">
                  Variantes disponibles ({item.variants.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {item.variants.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveVariantIndex(i)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        activeVariantIndex === i
                          ? 'bg-accent/15 border-accent/30 text-accent font-semibold'
                          : 'bg-surface2/40 border-border text-txt2 hover:bg-surface2 hover:text-txt'
                      )}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note explicative de la variante active */}
            {activeVariant && activeVariant.notes && (
              <div className="bg-bg/40 border border-border2/60 rounded-xl p-3.5">
                <h5 className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">
                  Notes de la variante : {activeVariant.name}
                </h5>
                <p className="text-txt text-xs leading-relaxed">{activeVariant.notes}</p>
              </div>
            )}
          </div>

          {/* Section droite : photo de référence */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] md:min-h-0 bg-bg/50 border border-border2/80 rounded-xl overflow-hidden p-2">
            {activeVariant && activeVariant.image_url ? (
              <div className="relative group w-full h-full min-h-[200px] flex flex-col justify-between">
                <img
                  src={activeVariant.image_url}
                  alt={activeVariant.name}
                  className="w-full h-full max-h-[350px] object-contain rounded-lg bg-black/10 cursor-zoom-in"
                  onClick={() => setIsLightboxOpen(true)}
                />
                <div className="text-center text-txt3 text-[10px] mt-1.5">
                  💡 Clique sur l'image pour l'agrandir en grand format
                </div>
              </div>
            ) : (
              <div className="text-center p-6">
                <span className="text-3xl block mb-2">🖼️</span>
                <p className="text-txt3 text-xs">Aucune image de référence pour cette variante.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── LIGHTBOX ZOOM PLEIN ÉCRAN ────────────────────────────────── */}
      {isLightboxOpen && activeVariant?.image_url && (
        <div
          className="fixed inset-0 bg-black/95 z-[250] flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-base transition-colors"
          >
            ✕
          </button>
          <img
            src={activeVariant.image_url}
            alt={activeVariant.name}
            className="max-w-full max-h-[90vh] object-contain"
          />
          <div className="mt-3 text-txt2 text-xs bg-surface/80 border border-border px-4 py-2 rounded-lg">
            {item.title} — <span className="text-accent font-semibold">{activeVariant.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}
