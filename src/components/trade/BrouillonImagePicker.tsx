import { useRef, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { cn } from '@/lib/utils'

interface BrouillonImagePickerProps {
  // URL de l'image actuellement stockée dans le brouillon (ou null)
  imageUrl: string | undefined
  // Callback déclenché quand une URL d'image est confirmée
  onImageChange: (url: string | null) => void
}

/**
 * Composant simplifié de sélection d'image pour les brouillons.
 * Contrairement à ImageField (qui upload dans Supabase Storage),
 * celui-ci stocke simplement l'URL de l'image (URL Telegram directe ou Data URL local).
 *
 * Exemple :
 * <BrouillonImagePicker
 *   imageUrl={brouillon.biais?.imageUrl}
 *   onImageChange={(url) => setImageUrl(url)}
 * />
 */
export function BrouillonImagePicker({ imageUrl, onImageChange }: BrouillonImagePickerProps) {
  const { isLoading, preview, fetchLastImage, clearPreview } = useTelegram()
  const fileRef = useRef<HTMLInputElement>(null)
  // Prévisualisation locale d'un fichier uploadé (avant confirmation)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  // Gère la sélection d'un fichier local → convertit en Data URL pour la prévisualisation
  const handleFichierSelectionne = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setLocalPreview(dataUrl)
    }
    reader.readAsDataURL(fichier)
  }

  // Confirme la preview Telegram comme image du brouillon
  const confirmerTelegram = () => {
    if (preview) {
      onImageChange(preview)
      clearPreview()
    }
  }

  // Confirme la preview locale (fichier) comme image du brouillon
  const confirmerLocal = () => {
    if (localPreview) {
      onImageChange(localPreview)
      setLocalPreview(null)
    }
  }

  // Annule toutes les previews en cours
  const annulerPreview = () => {
    clearPreview()
    setLocalPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ─── Si une image est déjà stockée dans le brouillon ───────────────────────

  if (imageUrl && !preview && !localPreview) {
    return (
      <div className="flex flex-col gap-2">
        <div className="border border-border2 rounded-md overflow-hidden">
          <img src={imageUrl} alt="Image du brouillon" className="w-full object-cover max-h-40" />
          <div className="flex gap-2 p-2 bg-surface2">
            {/* Bouton pour remplacer l'image existante */}
            <button
              type="button"
              onClick={() => fetchLastImage()}
              disabled={isLoading}
              className="flex-1 border border-border2 text-txt2 rounded-md py-1.5 text-[12px] hover:text-txt disabled:opacity-50"
            >
              {isLoading ? 'Récupération...' : '📱 Changer (Telegram)'}
            </button>
            <button
              type="button"
              onClick={() => onImageChange(null)}
              className="px-3 border border-loss/30 text-loss rounded-md py-1.5 text-[12px] hover:bg-loss/10"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Preview Telegram disponible (en attente de confirmation) ───────────────

  if (preview) {
    return (
      <div className="border border-border2 rounded-md overflow-hidden">
        <img src={preview} alt="Preview Telegram" className="w-full object-cover max-h-40" />
        <div className="flex gap-2 p-2 bg-surface2">
          <button
            type="button"
            onClick={confirmerTelegram}
            className="flex-1 bg-win/10 text-win border border-win/30 rounded-md py-1.5 text-[12px] font-medium hover:bg-win/20"
          >
            ✓ Utiliser cette image
          </button>
          <button
            type="button"
            onClick={annulerPreview}
            className="flex-1 border border-border2 text-txt2 rounded-md py-1.5 text-[12px] hover:text-txt"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  // ─── Preview fichier local disponible ──────────────────────────────────────

  if (localPreview) {
    return (
      <div className="border border-border2 rounded-md overflow-hidden">
        <img src={localPreview} alt="Preview locale" className="w-full object-cover max-h-40" />
        <div className="flex gap-2 p-2 bg-surface2">
          <button
            type="button"
            onClick={confirmerLocal}
            className="flex-1 bg-win/10 text-win border border-win/30 rounded-md py-1.5 text-[12px] font-medium hover:bg-win/20"
          >
            ✓ Utiliser cette image
          </button>
          <button
            type="button"
            onClick={annulerPreview}
            className="flex-1 border border-border2 text-txt2 rounded-md py-1.5 text-[12px] hover:text-txt"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  // ─── État initial : boutons de récupération ────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* Bouton Telegram */}
      <button
        type="button"
        onClick={() => fetchLastImage()}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-accent/7 border border-accent/20 rounded-md text-[12px] text-txt3 hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50"
      >
        <span>📱</span>
        {isLoading ? 'Récupération...' : 'Récupérer depuis Telegram'}
      </button>

      {/* Upload fichier local */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFichierSelectionne}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          'border-2 border-dashed border-border2 rounded-md py-3 text-center text-txt3 text-[12px]',
          'hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors cursor-pointer'
        )}
      >
        🖼 Cliquer pour uploader
      </button>
    </div>
  )
}
