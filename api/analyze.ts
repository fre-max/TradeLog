import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiVisionModel, jsonResponse, SMC_ANALYSIS_PROMPT } from './_utils'

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
      const imageRes = await fetch(imageUrl)
      if (!imageRes.ok) {
        throw new Error(`Échec du téléchargement de l'image (Statut HTTP : ${imageRes.status})`)
      }

      const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
      const arrayBuffer = await imageRes.arrayBuffer()
      const base64Image = Buffer.from(arrayBuffer).toString('base64')

      const model = genAI.getGenerativeModel({ model: getGeminiVisionModel() })
      const result = await model.generateContent([
        SMC_ANALYSIS_PROMPT,
        {
          inlineData: {
            data: base64Image,
            mimeType: contentType,
          },
        },
      ])

      const responseText = result.response.text()
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error(`La réponse de l'IA ne contient pas un objet JSON valide. Réponse brute : ${responseText}`)
      }

      return jsonResponse(JSON.parse(jsonMatch[0]))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur interne lors de l\'analyse de l\'image'
      console.error('❌ [Analyze API] Erreur d\'analyse :', error)
      return jsonResponse({ error: message }, 500)
    }
  },
}
