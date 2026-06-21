export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { 
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export const GEMINI_MODEL_DEFAUT = "gemini-3.1-flash-lite";

const MODELES_GEMINI_OBSOLETES = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
]);

/** Lu à l'exécution pour ignorer les anciens modèles. */
export function getGeminiVisionModel(): string {
  const configure = Deno.env.get('GEMINI_MODEL')?.trim();
  const modele = configure || GEMINI_MODEL_DEFAUT;
  if (MODELES_GEMINI_OBSOLETES.has(modele)) {
    console.warn(
      `⚠️ [Gemini] Modèle "${modele}" obsolète — utilisation de ${GEMINI_MODEL_DEFAUT}`,
    );
    return GEMINI_MODEL_DEFAUT;
  }
  return modele;
}

export const SMC_ANALYSIS_PROMPT = `Tu es un assistant spécialisé en analyse de trades SMC (Smart Money Concepts).
Analyse ce screenshot TradingView et extrais les informations suivantes en JSON.
La position peut être ouverte ou récemment fermée/manuelle sur le graphique.

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
}`;
