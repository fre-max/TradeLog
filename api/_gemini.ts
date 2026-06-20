import type { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiVisionModel, SMC_ANALYSIS_PROMPT } from './_utils'
/** Délai effectif — compressé sur Vercel Hobby (timeout 10–60 s selon plan). */
function getEffectiveRetryDelayMs(error: unknown): number {
  const parsed = parseGeminiRetryDelayMs(error)
  if (process.env.VERCEL) {
    return Math.min(parsed, 4_000)
  }
  return parsed
}

const MAX_GEMINI_RETRIES = process.env.VERCEL ? 2 : 3
const DEFAULT_RETRY_DELAY_MS = 20_000

/** Compresse bypassée : on envoie l'image brute à Gemini pour éviter les bugs de build avec jimp. */
export async function optimiserImagePourGemini(input: Buffer, contentType: string = 'image/jpeg'): Promise<{
  base64: string
  mimeType: string
  originalBytes: number
  optimizedBytes: number
}> {
  const originalBytes = input.byteLength

  console.log(`🖼️ [Gemini] Image brute envoyée : ${originalBytes} octets`)

  return {
    base64: input.toString('base64'),
    mimeType: contentType,
    originalBytes,
    optimizedBytes: originalBytes,
  }
}

export function isGeminiQuotaError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 429) return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('429') ||
    message.includes('Quota exceeded') ||
    message.includes('Too Many Requests') ||
    message.includes('RESOURCE_EXHAUSTED')
  )
}

/** Extrait le délai suggéré par l'API ("Please retry in 19.2s") ou utilise 20 s par défaut. */
export function parseGeminiRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i)
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 1_000
  }
  return DEFAULT_RETRY_DELAY_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateContentWithRetry(
  genAI: GoogleGenerativeAI,
  inlineData: { data: string; mimeType: string }
) {
  const model = genAI.getGenerativeModel({ model: getGeminiVisionModel() })
  const content = [SMC_ANALYSIS_PROMPT, { inlineData }] as const

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_GEMINI_RETRIES; attempt++) {
    try {
      return await model.generateContent([...content])
    } catch (error) {
      lastError = error

      if (!isGeminiQuotaError(error) || attempt === MAX_GEMINI_RETRIES) {
        throw error
      }

      const delayMs = getEffectiveRetryDelayMs(error)
      console.warn(
        `⚠️ [Gemini] Quota / rate limit (429) — tentative ${attempt}/${MAX_GEMINI_RETRIES}, attente ${Math.round(delayMs / 1000)}s`
      )
      await sleep(delayMs)
    }
  }

  throw lastError
}

/**
 * Télécharge, compresse et analyse une capture TradingView via Gemini Vision.
 * Gère automatiquement les retries en cas de 429 (Free Tier).
 */
export async function analyserImageUrlAvecGemini(
  genAI: GoogleGenerativeAI,
  imageUrl: string
): Promise<Record<string, unknown>> {
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Échec du téléchargement de l'image (${imageRes.status})`)
  }

  const arrayBuffer = await imageRes.arrayBuffer()
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
  const { base64, mimeType } = await optimiserImagePourGemini(Buffer.from(arrayBuffer), contentType)

  const result = await generateContentWithRetry(genAI, { data: base64, mimeType })

  const responseText = result.response.text()
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Gemini n\'a pas retourné de JSON valide')
  }

  return JSON.parse(jsonMatch[0]) as Record<string, unknown>
}

/** Message utilisateur clair quand le Free Tier est saturé. */
export function messageErreurQuotaGemini(error: unknown): string {
  const delaySec = Math.round(parseGeminiRetryDelayMs(error) / 1000)
  return (
    `Quota Gemini Free Tier atteint. Patiente ~${delaySec}s puis réessaie. ` +
    'Astuce : envoie des captures plus petites ou espacées dans le temps.'
  )
}
