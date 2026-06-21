import { GoogleGenAI } from 'npm:@google/genai'
import { analyserImageUrlAvecGemini, isGeminiQuotaError, messageErreurQuotaGemini } from '../_shared/gemini.ts'
import { jsonResponse, corsHeaders } from '../_shared/utils.ts'

const apiKey = Deno.env.get('GEMINI_API_KEY')
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Méthode non autorisée' }, 405)
  }

  const imageUrl = new URL(req.url).searchParams.get('url')
  if (!imageUrl) {
    return jsonResponse({ error: 'URL de l\\'image manquante (paramètre url requis)' }, 400)
  }

  if (!ai) {
    return jsonResponse({ error: 'Clé API Gemini non configurée sur le serveur' }, 500)
  }

  try {
    const data = await analyserImageUrlAvecGemini(ai, imageUrl)
    return jsonResponse(data)
  } catch (error: unknown) {
    if (isGeminiQuotaError(error)) {
      console.error('❌ [Analyze API] Quota Gemini Free Tier :', error)
      return jsonResponse({ error: messageErreurQuotaGemini(error) }, 429)
    }
    const message = error instanceof Error ? error.message : 'Erreur interne lors de l\\'analyse de l\\'image'
    console.error('❌ [Analyze API] Erreur d\\'analyse :', error)
    return jsonResponse({ error: message }, 500)
  }
})
