import { z } from 'zod'

export const PairEnum = z.enum(['XAUUSD','EURUSD','GBPUSD','NAS100','US30','BTCUSD'])
export const DirectionEnum = z.enum(['long','short'])
export const SessionEnum = z.enum(['Asian','London','NY','London/NY'])
export const ResultEnum = z.enum(['win','loss','breakeven','missed'])
export const ExitTypeEnum = z.enum(['tp','sl','breakeven','trailing','manual'])
export const StepTypeEnum = z.enum(['biais','poi','entry','result','custom','news'])
export const ImageSourceEnum = z.enum(['telegram','upload','url'])
export const StatusEnum = z.enum(['quick', 'in_progress', 'complete'])
export const JournalTypeEnum = z.enum(['global', 'bias', 'poi', 'confirmation'])
export const EmotionEnum = z.enum([
  'Discipliné','Confiant','FOMO','Impatient',
  'Revenge','Hésitant','Neutre','Focalisé'
])

export const StrategySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  context_rules: z.string().optional().nullable(),
  entry_rules: z.string().optional().nullable(),
  risk_rules: z.string().optional().nullable(),
  management_rules: z.string().optional().nullable(),
  created_at: z.string(),
})

export type Strategy = z.infer<typeof StrategySchema>
export type StrategyInsert = Omit<Strategy, 'id' | 'created_at'>

export const TradeSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  pair: z.union([PairEnum, z.string()]),
  direction: DirectionEnum,
  session: SessionEnum,
  date_backtested: z.string(),
  entry_time: z.string().optional().nullable(),
  exit_time: z.string().optional().nullable(),
  result: ResultEnum.optional().nullable(),
  rr_planned: z.number().positive().optional().nullable(),
  rr_realized: z.number().optional().nullable(),
  exit_type: ExitTypeEnum.optional().nullable(),
  emotion: EmotionEnum.optional().nullable(),
  strategy_id: z.string().uuid().optional().nullable(),
  status: StatusEnum.default('in_progress'),
  // Le type de journal permet de masquer/afficher dynamiquement les étapes du formulaire et de filtrer l'affichage
  journal_type: JournalTypeEnum.default('global'),
  created_at: z.string(),
})

export type Trade = z.infer<typeof TradeSchema>

export type TradeInsert = Omit<Trade, "id" | "created_at">

export const StepSchema = z.object({
  id: z.string().uuid(),
  trade_id: z.string().uuid(),
  order: z.number().int().nonnegative(),
  type: StepTypeEnum,
  title: z.string(),
  timeframe: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  fields: z.record(z.string(), z.unknown()).optional().nullable(),
  created_at: z.string(),
})

export type Step = z.infer<typeof StepSchema>
export type StepInsert = Omit<Step, 'id' | 'created_at'>

export const StepImageSchema = z.object({
  id: z.string().uuid(),
  step_id: z.string().uuid(),
  storage_path: z.string().optional().nullable(),
  source: ImageSourceEnum,
  url: z.string().optional().nullable(),
  created_at: z.string(),
})

export type StepImage = z.infer<typeof StepImageSchema>

export const ComboMemorySchema = z.object({
  id: z.string().uuid(),
  field_key: z.string(),
  value: z.string(),
  used_count: z.number().int().nonnegative(),
  last_used: z.string(),
})

export type ComboMemory = z.infer<typeof ComboMemorySchema>

export type TradeWithSteps = Trade & {
  steps: (Step & { images: StepImage[] })[]
}

export interface TelegramImageResult {
  fileUrl: string
  date: number
}

// ─── TYPES POUR LE CATALOGUE DE RAISONS DYNAMIQUES ─────────

export const ReasonFamilySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  icon: z.string().optional().nullable(),
  order: z.number().int().default(0),
  created_at: z.string(),
})

export type ReasonFamily = z.infer<typeof ReasonFamilySchema>
export type ReasonFamilyInsert = Omit<ReasonFamily, 'id' | 'created_at'>

// Schéma et type pour une variante de raison (ex: mineur, moyen, grand)
export const ReasonVariantSchema = z.object({
  id: z.string().uuid(),
  reason_id: z.string().uuid(),
  name: z.string(),
  image_url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  created_at: z.string(),
})

export type ReasonVariant = z.infer<typeof ReasonVariantSchema>
export type ReasonVariantInsert = Omit<ReasonVariant, 'id' | 'created_at'>

// Schéma et type pour un élément du catalogue de raisons (ex: Wyckoff candle)
export const ReasonCatalogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  family_id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional().nullable(),
  created_at: z.string(),
})

export type ReasonCatalogItem = z.infer<typeof ReasonCatalogSchema> & {
  variants: ReasonVariant[]
}
export type ReasonCatalogInsert = Omit<z.infer<typeof ReasonCatalogSchema>, 'id' | 'user_id' | 'created_at'>

