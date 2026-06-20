import { GoogleGenerativeAI } from '@google/generative-ai'
import { analyserImageUrlAvecGemini, isGeminiQuotaError, messageErreurQuotaGemini } from './_gemini'
import { jsonResponse } from './_utils'

const apiKey = process.env.GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

/**
 * Analyse une capture d'écran de graphique pour en extraire des données de trade SMC.
 *
 * Requête attendue : GET /api/analyze?url=https://...
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Méthode non autorisée' }, 405)
    }

    const imageUrl = new URL(request.url).searchParams.get('url')
    if (!imageUrl) {
      return jsonResponse({ error: 'URL de l\'image manquante (paramètre url requis)' }, 400)
    }

    if (!genAI) {
      return jsonResponse({ error: 'Clé API Gemini non configurée sur le serveur' }, 500)
    }

    try {
      const data = await analyserImageUrlAvecGemini(genAI, imageUrl)
      return jsonResponse(data)
    } catch (error: unknown) {
      if (isGeminiQuotaError(error)) {
        console.error('❌ [Analyze API] Quota Gemini Free Tier :', error)
        return jsonResponse({ error: messageErreurQuotaGemini(error) }, 429)
      }
      const message = error instanceof Error ? error.message : 'Erreur interne lors de l\'analyse de l\'image'
      console.error('❌ [Analyze API] Erreur d\'analyse :', error)
      return jsonResponse({ error: message }, 500)
    }
  },
}
