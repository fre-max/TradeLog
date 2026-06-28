import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ComboField } from '@/components/fields/ComboField'
import { CatalogReasonSelector } from '@/components/fields/CatalogReasonSelector'
import type { FormDataState } from '@/lib/tradeForm'
import { useBrouillonStore } from '@/store/brouillonStore'
import type { Brouillon } from '@/store/brouillonStore'
import { ImageField } from '@/components/fields/ImageField'
import { supabase } from '@/lib/supabase'

type StepType = 'general' | 'biais' | 'poi' | 'entry' | 'result' | 'custom'

// Props reçues par chaque bloc d'étape
// Permet de synchroniser les états locaux avec le formulaire global du TradeDrawer
interface StepBlockProps {
  number: number
  title: string
  type: StepType
  defaultOpen?: boolean
  formData: FormDataState
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>
  tradeId?: string
  stepId?: string
}

/**
 * Bloc accordéon représentant une étape de la configuration du trade.
 * Il affiche les formulaires adaptés au type de l'étape et modifie l'état partagé.
 * 
 * Exemple d'utilisation :
 * <StepBlock
 *   number={1}
 *   title="Infos générales"
 *   type="general"
 *   formData={formData}
 *   setFormData={setFormData}
 * />
 */
export function StepBlock({
  number,
  title,
  type,
  defaultOpen = false,
  formData,
  setFormData,
  tradeId,
  stepId,
}: StepBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  // ─── Récupère les brouillons depuis le store pour le bouton d'import ────────
  const brouillons = useBrouillonStore((state) => state.brouillons)
  const [showImportMenu, setShowImportMenu] = useState(false)

  // Détermine quels brouillons ont des données pour la section courante
  // Exemple : pour type='biais', on cherche les brouillons avec sections.biais rempli
  const brouillonsDisponibles = brouillons.filter((b: Brouillon) => {
    if (type === 'biais') return Boolean(b.sections.biais)
    if (type === 'poi') return Boolean(b.sections.poi)
    if (type === 'entry') return Boolean(b.sections.entry)
    return false
  })

  // Injecte les données du brouillon sélectionné dans le formulaire principal
  const importerDepuisBrouillon = (brouillon: Brouillon) => {
    if (type === 'biais' && brouillon.sections.biais) {
      const { biais_timeframe, biais_direction, biais_reasons } = brouillon.sections.biais
      setFormData((prev) => ({ ...prev, biais_timeframe, biais_direction, biais_reasons }))
    }
    if (type === 'poi' && brouillon.sections.poi) {
      const { poi_timeframe, poi_type, poi_confluences } = brouillon.sections.poi
      setFormData((prev) => ({ ...prev, poi_timeframe, poi_type, poi_confluences }))
    }
    if (type === 'entry' && brouillon.sections.entry) {
      const { entry_timeframe, entry_setup, entry_price, entry_sl, entry_tp, entry_trailing, entry_reasons } = brouillon.sections.entry
      setFormData((prev) => ({ ...prev, entry_timeframe, entry_setup, entry_price, entry_sl, entry_tp, entry_trailing, entry_reasons }))
    }
    setShowImportMenu(false)
  }

  // Les sections qui supportent l'import de brouillon
  const sectionAvecImport = type === 'biais' || type === 'poi' || type === 'entry'

  return (
    <div className="border-b border-border">
      {/* En-tête cliquable pour ouvrir/fermer l'étape */}
      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <div className={cn(
            'w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-all',
            open ? 'border-accent bg-accent text-white' : 'border-border2 text-txt3'
          )}>
            {number}
          </div>
          <span className="text-txt text-[13.5px] font-medium flex-1">{title}</span>
          <span className={cn('text-txt3 text-[11px] transition-transform', open && 'rotate-90')}>▶</span>
        </button>

        {/* Bouton d'import depuis brouillon — visible uniquement si des données existent */}
        {sectionAvecImport && brouillonsDisponibles.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowImportMenu((v) => !v)}
              title="Importer depuis un brouillon"
              className="text-[11px] px-2 py-1 bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/25 rounded-md hover:bg-[#7c3aed]/20 transition-colors font-medium"
            >
              💾 Importer
            </button>

            {/* Dropdown des brouillons disponibles */}
            {showImportMenu && (
              <>
                {/* Overlay transparent pour fermer en cliquant ailleurs */}
                <div className="fixed inset-0 z-[5]" onClick={() => setShowImportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-[10] min-w-[160px] overflow-hidden">
                  <p className="text-txt3 text-[10px] px-3 py-1.5 border-b border-border uppercase tracking-wider">Choisir un brouillon</p>
                  {brouillonsDisponibles.map((brouillon: Brouillon) => (
                    <button
                      key={brouillon.id}
                      type="button"
                      onClick={() => importerDepuisBrouillon(brouillon)}
                      className="w-full text-left px-3 py-2 text-[12.5px] text-txt hover:bg-accent/8 transition-colors flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-[10px] font-bold">{brouillon.id}</span>
                      Brouillon {brouillon.id}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Contenu de l'étape affiché si ouvert */}
      {open && (
        <div className="px-5 pb-5 pl-[54px]">
          {type === 'general' && <GeneralFields formData={formData} setFormData={setFormData} />}
          {type === 'biais' && <BiaisFields formData={formData} setFormData={setFormData} tradeId={tradeId} stepId={stepId} />}
          {type === 'poi' && <PoiFields formData={formData} setFormData={setFormData} tradeId={tradeId} stepId={stepId} />}
          {type === 'entry' && <EntryFields formData={formData} setFormData={setFormData} tradeId={tradeId} stepId={stepId} />}
          {type === 'result' && <ResultFields formData={formData} setFormData={setFormData} tradeId={tradeId} stepId={stepId} />}
        </div>
      )}
    </div>
  )
}

// ─── COMPOSANTS REUTILISABLES POUR LES CHAMPS ────────────────

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 mb-3">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent"
    >
      {children}
    </select>
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full bg-bg border border-border2 rounded-md text-txt px-3 py-2 text-[13.5px] outline-none focus:border-accent resize-y min-h-[72px]"
    />
  )
}

// ─── FORMULAIRES D'ÉTAPES SPÉCIFIQUES ────────────────────────

// Met à jour une propriété spécifique du store de formulaire global
// Exemple d'utilisation : updateField('pair', 'EURUSD')
const createFieldUpdater = (setFormData: React.Dispatch<React.SetStateAction<FormDataState>>) => 
  (key: keyof FormDataState, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }))
  }

// Étape 1 : Informations générales du trade (Paire, date, session, heure, type de journal)
function GeneralFields({ formData, setFormData }: { formData: FormDataState; setFormData: React.Dispatch<React.SetStateAction<FormDataState>> }) {
  const updateField = createFieldUpdater(setFormData)

  const isBiais = formData.journal_type === 'bias'

  return (
    <>
      <div className="mb-3">
        <Field label="Type de Journal">
          <Select
            value={formData.journal_type}
            onChange={(e) => updateField('journal_type', e.target.value as any)}
          >
            <option value="global">📋 Global</option>
            <option value="bias">🎯 Biais</option>
            <option value="poi">🗺️ POI / Zones</option>
            <option value="confirmation">⚡ Confirmation</option>
          </Select>
        </Field>
      </div>

      <FieldGrid>
        <Field label="Paire">
          <Select
            value={formData.pair}
            onChange={(e) => updateField('pair', e.target.value)}
          >
            {['XAUUSD','EURUSD','GBPUSD','NAS100','US30','BTCUSD'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value="Autre">Autre...</option>
          </Select>
        </Field>
        <Field label="Date backtestée">
          <Input
            type="date"
            value={formData.date_backtested}
            onChange={(e) => updateField('date_backtested', e.target.value)}
          />
        </Field>
        <Field label="Session">
          <Select
            value={formData.session}
            onChange={(e) => updateField('session', e.target.value)}
          >
            {['Asian','London','NY','London/NY'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label={isBiais ? "Début validité Biais" : "Heure d'entrée"}>
          <Input
            type="time"
            value={formData.entry_time}
            onChange={(e) => updateField('entry_time', e.target.value)}
          />
        </Field>
        {isBiais && (
          <Field label="Fin validité Biais">
            <Input
              type="time"
              value={formData.exit_time}
              onChange={(e) => updateField('exit_time', e.target.value)}
            />
          </Field>
        )}
      </FieldGrid>
      
      <Field label={isBiais ? "Biais (Direction)" : "Direction"}>
        <div className="flex rounded-md overflow-hidden border border-border2">
          {(['long', 'short'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => updateField('direction', d)}
              className={cn(
                'flex-1 py-2 text-[13px] font-medium transition-colors',
                formData.direction === d && d === 'long' && 'bg-accent/10 text-accent',
                formData.direction === d && d === 'short' && 'bg-[#f08a4f]/10 text-[#f08a4f]',
                formData.direction !== d && 'bg-bg text-txt3'
              )}
            >
              {d === 'long' ? '↑ Long (Acheteur)' : '↓ Short (Vendeur)'}
            </button>
          ))}
        </div>
      </Field>
    </>
  )
}

// Étape 2 : Analyse du Biais (Direction du biais, Timeframe d'analyse, Raisons)
function BiaisFields({ formData, setFormData, tradeId, stepId }: { formData: FormDataState; setFormData: React.Dispatch<React.SetStateAction<FormDataState>>; tradeId?: string; stepId?: string }) {
  const updateField = createFieldUpdater(setFormData)

  return (
    <>
      <FieldGrid>
        <Field label="Timeframe d'analyse">
          <Select
            value={formData.biais_timeframe}
            onChange={(e) => updateField('biais_timeframe', e.target.value)}
          >
            {['W1','D1','H4','H1','M30','M15'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Direction du biais">
          <Select
            value={formData.biais_direction}
            onChange={(e) => updateField('biais_direction', e.target.value)}
          >
            {['Haussier','Baissier','Neutre / Range'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <div className="mb-3">
        <Field label="Raisons du biais">
          <ComboField
            fieldKey="biais_reasons"
            placeholder="Ex: BOS haussier H4, liquidités prises..."
            presets={['BOS haussier sur H4','CHoCH baissier confirmé','Liquidités basses prises','Prix au-dessus EQ H4']}
            value={formData.biais_reasons}
            onChange={(val) => updateField('biais_reasons', val)}
          />
        </Field>
      </div>
      <div className="mb-3">
        <Field label="Concepts du Catalogue (Biais)">
          <CatalogReasonSelector
            contextType={['biais', 'confirmation']}
            value={formData.biais_catalog_reasons}
            onChange={(val) => updateField('biais_catalog_reasons', val)}
          />
        </Field>
      </div>
      <StepImageManager
        label="Chart biais"
        images={formData.biais_images}
        onChange={(imgs) => setFormData((prev) => ({ ...prev, biais_images: imgs }))}
        tradeId={tradeId}
        stepId={stepId}
      />
    </>
  )
}

// Étape 3 : Point d'intérêt / Zone (Type de zone, Timeframe, Confluences)
function PoiFields({ formData, setFormData, tradeId, stepId }: { formData: FormDataState; setFormData: React.Dispatch<React.SetStateAction<FormDataState>>; tradeId?: string; stepId?: string }) {
  const updateField = createFieldUpdater(setFormData)

  return (
    <>
      <FieldGrid>
        <Field label="Timeframe du POI">
          <Select
            value={formData.poi_timeframe}
            onChange={(e) => updateField('poi_timeframe', e.target.value)}
          >
            {['H4','H1','M30','M15','M5','M1'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Type de zone">
          <Select
            value={formData.poi_type}
            onChange={(e) => updateField('poi_type', e.target.value)}
          >
            {['Order Block','FVG','S&R','Liquidity','EQ / Equilibrium','Autre...'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <div className="mb-3">
        <Field label="Confluences">
          <ComboField
            fieldKey="poi_confluences"
            placeholder="Ex: OB aligné avec 50% du swing..."
            presets={['OB aligné avec 50% du dernier swing','FVG en dessous comme support','Zone premium / discount']}
            value={formData.poi_confluences}
            onChange={(val) => updateField('poi_confluences', val)}
          />
        </Field>
      </div>
      <div className="mb-3">
        <Field label="Concepts du Catalogue (POI)">
          <CatalogReasonSelector
            contextType="poi"
            value={formData.poi_catalog_reasons}
            onChange={(val) => updateField('poi_catalog_reasons', val)}
          />
        </Field>
      </div>
      <StepImageManager
        label="Chart POI"
        images={formData.poi_images}
        onChange={(imgs) => setFormData((prev) => ({ ...prev, poi_images: imgs }))}
        tradeId={tradeId}
        stepId={stepId}
      />
    </>
  )
}

// Étape 4 : Détails d'Entrée sur le marché (SL, TP, Setup, Prix, Trailing, Sortie)
function EntryFields({ formData, setFormData, tradeId, stepId }: { formData: FormDataState; setFormData: React.Dispatch<React.SetStateAction<FormDataState>>; tradeId?: string; stepId?: string }) {
  const updateField = createFieldUpdater(setFormData)

  return (
    <>
      <FieldGrid>
        <Field label="Timeframe">
          <Select
            value={formData.entry_timeframe}
            onChange={(e) => updateField('entry_timeframe', e.target.value)}
          >
            {['M15','M5','M1','M30','H1'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Setup / Pattern">
          <ComboField
            fieldKey="entry_setup"
            placeholder="Ex: CHoCH, OB M5..."
            presets={['BOS','CHoCH','Order Block','FVG','Liquidity grab','EMA confluence']}
            value={formData.entry_setup}
            onChange={(val) => updateField('entry_setup', val)}
          />
        </Field>
        <Field label="Prix d'entrée">
          <Input
            type="number"
            step="0.00001"
            placeholder="0.00000"
            value={formData.entry_price}
            onChange={(e) => updateField('entry_price', e.target.value)}
          />
        </Field>
        <Field label="Stop Loss">
          <Input
            type="number"
            step="0.00001"
            placeholder="0.00000"
            value={formData.entry_sl}
            onChange={(e) => updateField('entry_sl', e.target.value)}
          />
        </Field>
        <Field label="Take Profit">
          <Input
            type="number"
            step="0.00001"
            placeholder="0.00000"
            value={formData.entry_tp}
            onChange={(e) => updateField('entry_tp', e.target.value)}
          />
        </Field>
        <Field label="Trailing Stop">
          <Input
            type="text"
            placeholder="ex: 20 pips"
            value={formData.entry_trailing}
            onChange={(e) => updateField('entry_trailing', e.target.value)}
          />
        </Field>
        <Field label="R:R prévu">
          <Input
            type="number"
            step="0.1"
            placeholder="2.0"
            value={formData.rr_planned}
            onChange={(e) => updateField('rr_planned', e.target.value)}
          />
        </Field>
        <Field label="Sortie via">
          <Select
            value={formData.exit_type}
            onChange={(e) => updateField('exit_type', e.target.value as any)}
          >
            {[
              { key: 'tp', label: 'TP atteint' },
              { key: 'sl', label: 'SL atteint' },
              { key: 'breakeven', label: 'Breakeven' },
              { key: 'trailing', label: 'Trailing Stop' },
              { key: 'manual', label: 'Sortie manuelle' },
            ].map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </Select>
        </Field>
      </FieldGrid>
      <div className="mb-4 pt-3 border-t border-border/40 space-y-3">
        <p className="text-[11px] font-semibold text-txt2 uppercase tracking-wider">Concepts du Catalogue Technique</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <Field label="Concepts SL (Catalogue)">
            <CatalogReasonSelector
              contextType="sl"
              value={formData.sl_catalog_reasons}
              onChange={(val) => updateField('sl_catalog_reasons', val)}
            />
          </Field>
 
          <Field label="Concepts TP (Catalogue)">
            <CatalogReasonSelector
              contextType="tp"
              value={formData.tp_catalog_reasons}
              onChange={(val) => updateField('tp_catalog_reasons', val)}
            />
          </Field>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <Field label="Concepts Trailing (Catalogue)">
            <CatalogReasonSelector
              contextType="trailing"
              value={formData.trailing_catalog_reasons}
              onChange={(val) => updateField('trailing_catalog_reasons', val)}
            />
          </Field>
 
          <Field label="Concepts Entrée (Catalogue)">
            <CatalogReasonSelector
              contextType={['entry', 'confirmation']}
              value={formData.entry_catalog_reasons}
              onChange={(val) => updateField('entry_catalog_reasons', val)}
            />
          </Field>
        </div>
      </div>
 
      <div className="mb-3">
        <Field label="Raisons de l'entrée">
          <ComboField
            fieldKey="entry_reasons"
            placeholder="Ex: CHoCH M5 sur le POI..."
            presets={["CHoCH M5 confirmed sur le POI","Bougie englobante haussière","Retest du bris de structure","Confluences multiples alignées"]}
            value={formData.entry_reasons}
            onChange={(val) => updateField('entry_reasons', val)}
          />
        </Field>
      </div>
      <StepImageManager
        label="Chart entrée"
        images={formData.entry_images}
        onChange={(imgs) => setFormData((prev) => ({ ...prev, entry_images: imgs }))}
        tradeId={tradeId}
        stepId={stepId}
      />
    </>
  )
}

// Étape 5 : Résultat, émotions et revue écrite
function ResultFields({ formData, setFormData, tradeId, stepId }: { formData: FormDataState; setFormData: React.Dispatch<React.SetStateAction<FormDataState>>; tradeId?: string; stepId?: string }) {
  const updateField = createFieldUpdater(setFormData)
  const [analysantIA, setAnalysantIA] = useState(false)

  // Appelle l'Edge Function pour analyser le dénouement (win, loss, missed) depuis la capture de fin
  const analyserDenouementAvecIA = async () => {
    const premiereImage = formData.result_images[0]
    if (!premiereImage) return

    setAnalysantIA(true)
    console.log("🚀 [ResultFields] Début de l'analyse IA de clôture...")

    try {
      const response = await supabase.functions.invoke('analyze', {
        body: {
          url: premiereImage.url,
          mode: 'close',
          direction: formData.direction,
          entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
          sl: formData.entry_sl ? parseFloat(formData.entry_sl) : null,
          tp: formData.entry_tp ? parseFloat(formData.entry_tp) : null,
        }
      })

      if (response.error) throw response.error

      const res = response.data
      console.log('✅ [ResultFields] Analyse IA terminée. Résultat détecté :', res)

      // Mettre à jour les champs du formulaire avec les prédictions de Gemini
      if (res.result) {
        updateField('result', res.result)
      }
      if (res.rr_realized != null) {
        updateField('rr_realized', String(res.rr_realized))
      }
      if (res.missed_gap != null) {
        updateField('missed_gap', String(res.missed_gap))
      }
      if (res.missed_reason) {
        updateField('missed_reason', res.missed_reason)
      }
      if (res.exit_time) {
        setFormData((prev) => ({ ...prev, exit_time: res.exit_time }))
      }

    } catch (err: any) {
      console.error("❌ [ResultFields] Échec de l'analyse IA :", err)
      alert(err.message || "Erreur lors de l'analyse par l'IA.")
    } finally {
      setAnalysantIA(false)
    }
  }

  const typeJournal = formData.journal_type || 'global'

  // Boutons personnalisés selon le type de journal
  let labelResultat = "Résultat"
  let buttons: { key: 'win' | 'loss' | 'breakeven' | 'missed'; label: string }[] = [
    { key: 'win' as const, label: '✓ Win' },
    { key: 'loss' as const, label: '✗ Loss' },
    { key: 'breakeven' as const, label: '— Breakeven' },
  ]

  if (typeJournal === 'bias') {
    labelResultat = "Biais Correct ?"
    buttons = [
      { key: 'win' as const, label: '✓ Oui' },
      { key: 'loss' as const, label: '✗ Non' },
      { key: 'breakeven' as const, label: '— Invalide / BE' },
    ]
  } else if (typeJournal === 'poi') {
    labelResultat = "Réaction du POI ?"
    buttons = [
      { key: 'win' as const, label: '✓ Réagi' },
      { key: 'loss' as const, label: '✗ Cassé' },
      { key: 'breakeven' as const, label: '— Non atteint' },
    ]
  } else {
    // Si c'est global ou confirmation, on propose l'option de trade manqué
    buttons.push({ key: 'missed' as const, label: '🟡 Missed' })
  }

  const colors = {
    win: 'border-win bg-win/10 text-win',
    loss: 'border-loss bg-loss/10 text-loss',
    breakeven: 'border-be bg-be/10 text-be',
    missed: 'border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]',
  }

  const afficherInfosFinancieres = typeJournal === 'global' || typeJournal === 'confirmation'

  return (
    <>
      <div className="mb-3">
        <label className="text-txt3 text-[11px] font-medium uppercase tracking-wider block mb-1.5">{labelResultat}</label>
        <div className="flex gap-2 flex-wrap">
          {buttons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                updateField('result', key)
                // Si c'est missed, le R:R réalisé est de 0
                if (key === 'missed') {
                  updateField('rr_realized', '0')
                }
              }}
              className={cn(
                'flex-1 py-2 rounded-md border-[1.5px] text-[12.5px] font-medium transition-all min-w-[80px]',
                formData.result === key ? colors[key] : 'border-border2 bg-bg text-txt3'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {afficherInfosFinancieres && formData.result !== 'missed' && (
        <FieldGrid>
          <Field label="R:R réalisé">
            <Input
              type="number"
              step="0.1"
              placeholder="0.0"
              value={formData.rr_realized}
              onChange={(e) => updateField('rr_realized', e.target.value)}
            />
          </Field>
          <Field label="État émotionnel">
            <Select
              value={formData.emotion}
              onChange={(e) => updateField('emotion', e.target.value)}
            >
              <option value="">Sélectionner...</option>
              {['Discipliné','Confiant','FOMO','Impatient','Revenge','Hésitant','Neutre','Focalisé'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
      )}

      {/* Champs affichés spécifiquement si l'ordre a été manqué / non déclenché */}
      {afficherInfosFinancieres && formData.result === 'missed' && (
        <FieldGrid>
          <Field label="Écart de déclenchement (Pips)">
            <Input
              type="number"
              step="0.1"
              placeholder="ex: 2.5"
              value={formData.missed_gap}
              onChange={(e) => updateField('missed_gap', e.target.value)}
            />
          </Field>
          <Field label="Raison du manquement">
            <Input
              type="text"
              placeholder="ex: OB non atteint de peu"
              value={formData.missed_reason}
              onChange={(e) => updateField('missed_reason', e.target.value)}
            />
          </Field>
        </FieldGrid>
      )}

      <div className="flex flex-col gap-3 mb-3">
        <Field label="Ce que j'ai bien fait">
          <Textarea
            placeholder="..."
            value={formData.review_good}
            onChange={(e) => updateField('review_good', e.target.value)}
          />
        </Field>
        <Field label="À améliorer">
          <Textarea
            placeholder="..."
            value={formData.review_bad}
            onChange={(e) => updateField('review_bad', e.target.value)}
          />
        </Field>
      </div>

      <StepImageManager
        label="Chart Résultat (Fin du trade)"
        images={formData.result_images}
        onChange={(imgs) => setFormData((prev) => ({ ...prev, result_images: imgs }))}
        tradeId={tradeId}
        stepId={stepId}
      />

      {formData.result_images && formData.result_images.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={analyserDenouementAvecIA}
            disabled={analysantIA}
            className="w-full py-2 bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/25 hover:bg-[#7c3aed]/15 rounded-md text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {analysantIA ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#7c3aed]/20 border-t-[#7c3aed] rounded-full animate-spin" />
                <span>Analyse du dénouement par Gemini...</span>
              </>
            ) : (
              <>
                <span>🧠</span>
                <span>Analyser la capture de fin par l'IA</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  )
}

interface StepImageManagerProps {
  label: string
  images: { id: string; url: string; source: 'telegram' | 'upload' | 'url' }[]
  onChange: (images: { id: string; url: string; source: 'telegram' | 'upload' | 'url' }[]) => void
  tradeId?: string
  stepId?: string
}

function StepImageManager({
  label,
  images,
  onChange,
  tradeId,
  stepId,
}: StepImageManagerProps) {
  return (
    <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-border/40">
      <label className="text-txt3 text-[11px] font-semibold uppercase tracking-wider">{label}</label>
      
      {/* Liste des images existantes pour cette étape */}
      {images && images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative w-28 h-20 bg-bg border border-border2 rounded-md overflow-hidden group flex-shrink-0"
            >
              <img src={img.url} alt="Chart thumbnail" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((i) => i.id !== img.id))}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-semibold transition-opacity"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composant de téléversement d'image réel */}
      {tradeId && stepId ? (
        <ImageField
          tradeId={tradeId}
          stepId={stepId}
          onUpload={(publicUrl) => {
            onChange([...images, { id: crypto.randomUUID(), url: publicUrl, source: 'upload' }])
          }}
        />
      ) : (
        <p className="text-txt3 text-[11px] italic">Identifiants manquants pour téléverser une image.</p>
      )}
    </div>
  )
}
