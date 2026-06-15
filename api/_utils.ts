export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

const MODELES_GEMINI_OBSOLETES = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
])

/** Lu à l'exécution pour respecter les variables Vercel et ignorer les anciens modèles. */
export function getGeminiVisionModel(): string {
  const configure = process.env.GEMINI_MODEL?.trim()
  const modele = configure || 'gemini-2.0-flash'
  if (MODELES_GEMINI_OBSOLETES.has(modele)) {
    console.warn(`⚠️ [Gemini] Modèle "${modele}" obsolète — utilisation de gemini-2.0-flash`)
    return 'gemini-2.0-flash'
  }
  return modele
}

export const SMC_ANALYSIS_PROMPT = `Tu es un assistant spécialisé en analyse de trades SMC (Smart Money Concepts).
Analyse ce screenshot TradingView et extrais les informations suivantes en JSON.
La position est toujours ouverte et visible sur le chart.

Retourne UNIQUEMENT ce JSON, sans texte supplémentaire :
{
  "pair": "paire tradée (ex: XAUUSD, EURUSD...)",
  "direction": "long ou short",
  "entry_price": nombre ou null,
  "sl": nombre ou null,
  "tp": nombre ou null,
  "timeframe": "timeframe visible (ex: M15, H1...)",
  "session": "Asian, London, NY ou London/NY selon l'heure visible, ou null",
  "rr": nombre calculé depuis entrée/SL/TP ou null,
  "patterns": ["patterns SMC visibles si annotés sur le chart"],
  "confidence": {
    "pair": 0.0 à 1.0,
    "direction": 0.0 à 1.0,
    "entry_price": 0.0 à 1.0,
    "sl": 0.0 à 1.0,
    "tp": 0.0 à 1.0
  }
}`
