import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { analyserImageUrlAvecGemini, isGeminiQuotaError, messageErreurQuotaGemini } from './_gemini'
import { getGeminiVisionModel, jsonResponse } from './_utils'

const geminiApiKey = process.env.GEMINI_API_KEY
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

interface TelegramFile {
  file_id: string
}

interface TelegramMessage {
  message_id: number
  date: number
  photo?: TelegramFile[]
  caption?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

interface TelegramResponse {
  ok: boolean
  result: TelegramUpdate[]
}

interface TelegramFileResponse {
  ok: boolean
  result: { file_path: string }
}

interface WebhookInfoResponse {
  ok: boolean
  result: { url?: string }
}

async function verifierWebhook(token: string): Promise<string | null> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const data: WebhookInfoResponse = await res.json()
  return data.result?.url || null
}

/**
 * Récupère la photo la plus récente en attente dans la file Telegram.
 * getUpdates ne fonctionne que si aucun webhook n'est configuré sur le bot.
 */
async function getDernierMessagePhoto(token: string): Promise<{
  message: TelegramMessage | null
  maxUpdateId: number
}> {
  const webhookUrl = await verifierWebhook(token)
  if (webhookUrl) {
    throw new Error(
      'Un webhook Telegram est actif sur ce bot. Ouvrez https://api.telegram.org/bot<VOTRE_TOKEN>/deleteWebhook dans le navigateur pour activer le Quick Entry.'
    )
  }

  const updatesRes = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent('["message"]')}`
  )
  const updates: TelegramResponse = await updatesRes.json()

  if (!updates.ok || !updates.result?.length) {
    return { message: null, maxUpdateId: 0 }
  }

  let dernierMessage: TelegramMessage | null = null
  let maxUpdateId = 0

  for (const update of updates.result) {
    maxUpdateId = Math.max(maxUpdateId, update.update_id)
    const msg = update.message
    if (!msg?.photo?.length) continue
    if (!dernierMessage || msg.message_id > dernierMessage.message_id) {
      dernierMessage = msg
    }
  }

  return { message: dernierMessage, maxUpdateId }
}

async function acquitterUpdates(token: string, maxUpdateId: number): Promise<void> {
  if (maxUpdateId > 0) {
    await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${maxUpdateId + 1}`)
  }
}

interface TelegramBotInfo {
  id: number
  username: string
  first_name: string
}

interface TelegramMeResponse {
  ok: boolean
  result: TelegramBotInfo
}

/**
 * Teste la connexion au bot sans appeler Gemini ni consommer la file de messages.
 * GET /api/telegram?ping=1
 */
async function testerConnexionBot(token: string): Promise<Response> {
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const meData: TelegramMeResponse = await meRes.json()

  if (!meData.ok) {
    return jsonResponse({ mode: 'ping', ok: false, error: 'Token Telegram invalide' }, 401)
  }

  const webhookUrl = await verifierWebhook(token)

  const updatesRes = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent('["message"]')}`
  )
  const updates: TelegramResponse = await updatesRes.json()

  const pendingUpdates = updates.result?.length ?? 0
  let pendingPhotos = 0
  for (const update of updates.result ?? []) {
    if (update.message?.photo?.length) pendingPhotos++
  }

  return jsonResponse({
    mode: 'ping',
    ok: true,
    bot: {
      id: meData.result.id,
      username: meData.result.username,
      name: meData.result.first_name,
    },
    webhook: {
      active: Boolean(webhookUrl),
      url: webhookUrl,
    },
    queue: {
      pendingUpdates,
      pendingPhotos,
    },
    gemini: {
      configured: Boolean(genAI),
      model: getGeminiVisionModel(),
    },
  })
}

async function analyserImageAvecGemini(imageUrl: string): Promise<Record<string, unknown>> {
  if (!genAI) {
    throw new Error('Clé API Gemini non configurée sur le serveur')
  }
  return analyserImageUrlAvecGemini(genAI, imageUrl)
}

/**
 * Lit le dernier message du bot Telegram, extrait l'image et route selon la caption.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Méthode non autorisée' }, 405)
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return jsonResponse({ error: 'Token du bot Telegram non configuré' }, 500)
    }

    const url = new URL(request.url)
    if (url.searchParams.get('ping') === '1' || url.searchParams.get('test') === '1') {
      return testerConnexionBot(token)
    }

    try {
      console.log('📡 [Telegram API] Récupération du dernier message Telegram...')

      const { message, maxUpdateId } = await getDernierMessagePhoto(token)
      if (!message?.photo?.length) {
        console.log('❌ [Telegram API] Aucune image récente trouvée dans le bot')
        // Libère les messages texte en attente pour ne pas bloquer la file
        await acquitterUpdates(token, maxUpdateId)
        return jsonResponse({
          error: 'Aucune image en attente. Envoie d\'abord une capture au bot Telegram, puis clique à nouveau sur le bouton.',
          hint: 'Envoie une photo avec la légende "quick" pour un Quick Entry automatique.',
        }, 422)
      }

      const photo = message.photo[message.photo.length - 1]
      const fileRes = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${photo.file_id}`
      )
      const fileData: TelegramFileResponse = await fileRes.json()

      if (!fileData.ok || !fileData.result?.file_path) {
        throw new Error('Impossible de récupérer le fichier Telegram')
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
      const caption = (message.caption || '').toLowerCase().trim()
      console.log('✅ [Telegram API] Image trouvée. Caption :', caption || '(aucune)')

      if (caption === 'q' || caption === 'quick') {
        console.log('🚀 [Telegram API] Mode Quick Entry détecté')
        const analysisData = await analyserImageAvecGemini(fileUrl)

        const authHeader = request.headers.get('authorization')
        if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
          console.log('⚠️ [Telegram API] Pas d\'en-tête d\'autorisation, renvoi des données pour création client')
          await acquitterUpdates(token, maxUpdateId)
          return jsonResponse({
            mode: 'quick_fallback',
            fileUrl,
            analysis: analysisData,
            date: message.date,
          })
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        })

        // Caster supabase.auth en any pour bypasser les conflits de types sur Vercel
        const { data: { user }, error: userError } = await (supabase.auth as any).getUser()
        if (userError || !user) {
          throw new Error('JWT invalide ou utilisateur non authentifié côté Supabase')
        }

        const tradeData = {
          user_id: user.id,
          pair: (analysisData.pair as string) || 'XAUUSD',
          direction: ((analysisData.direction as string) || 'long') as 'long' | 'short',
          session: (analysisData.session as string) || 'London',
          date_backtested: new Date().toISOString().split('T')[0],
          entry_time: null,
          result: null,
          rr_planned: analysisData.rr ? parseFloat(String(analysisData.rr)) : null,
          rr_realized: null,
          exit_type: null,
          emotion: null,
          status: 'quick' as const,
        }

        const { data: insertedTrade, error: tradeInsertError } = await supabase
          .from('trades')
          .insert(tradeData)
          .select()
          .single()

        if (tradeInsertError || !insertedTrade) {
          throw tradeInsertError || new Error('Erreur lors de la création du trade')
        }

        const stepData = {
          trade_id: insertedTrade.id,
          order: 0,
          type: 'biais',
          title: 'Infos générales (Quick Entry)',
          timeframe: (analysisData.timeframe as string) || null,
          notes: `Patterns SMC identifiés : ${((analysisData.patterns as string[]) || []).join(', ') || 'aucun'}`,
          fields: {
            extracted: analysisData,
            is_quick_entry: true,
          },
        }

        const { data: insertedStep, error: stepInsertError } = await supabase
          .from('steps')
          .insert(stepData)
          .select()
          .single()

        if (stepInsertError || !insertedStep) {
          throw stepInsertError || new Error('Erreur lors de la création de l\'étape générale')
        }

        const { error: imageInsertError } = await supabase
          .from('step_images')
          .insert({
            step_id: insertedStep.id,
            source: 'telegram',
            url: fileUrl,
          })

        if (imageInsertError) {
          console.error('❌ [Telegram API] Erreur lors de l\'enregistrement de l\'image :', imageInsertError)
        }

        console.log('✅ [Telegram API] Trade rapide et étape créés en BDD. ID Trade :', insertedTrade.id)

        await acquitterUpdates(token, maxUpdateId)
        return jsonResponse({
          mode: 'quick',
          tradeId: insertedTrade.id,
          analysis: analysisData,
          fileUrl,
          date: message.date,
        })
      }

      if (caption === 'a' || caption === 'analyse') {
        console.log('🚀 [Telegram API] Mode Analyse seule détecté')
        const analysisData = await analyserImageAvecGemini(fileUrl)

        await acquitterUpdates(token, maxUpdateId)
        return jsonResponse({
          mode: 'analyse',
          fileUrl,
          analysis: analysisData,
          date: message.date,
        })
      }

      console.log('🚀 [Telegram API] Mode Standard détecté (stockage d\'image simple)')
      
      // Si un step_id est fourni en paramètre, attacher l'image à ce step
      const stepId = url.searchParams.get('step_id')
      if (stepId) {
        console.log('📎 [Telegram API] step_id fourni, attachement de l\'image au step :', stepId)
        
        if (!supabaseUrl || !supabaseAnonKey) {
          console.warn('⚠️ [Telegram API] Supabase non configuré, impossible d\'attacher l\'image au step')
        } else {
          const authHeader = request.headers.get('authorization')
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader || '' } },
          })

          const { error: imageInsertError } = await supabase
            .from('step_images')
            .insert({
              step_id: stepId,
              source: 'telegram',
              url: fileUrl,
            })

          if (imageInsertError) {
            console.error('❌ [Telegram API] Erreur lors de l\'enregistrement de l\'image :', imageInsertError)
          } else {
            console.log('✅ [Telegram API] Image attachée au step avec succès')
          }
        }
      }
      
      await acquitterUpdates(token, maxUpdateId)
      return jsonResponse({
        mode: 'standard',
        fileUrl,
        date: message.date,
        stepId: stepId || null,
      })
    } catch (error: unknown) {
      if (isGeminiQuotaError(error)) {
        console.error('❌ [Telegram API] Quota Gemini Free Tier :', error)
        return jsonResponse({ error: messageErreurQuotaGemini(error) }, 429)
      }
      const message = error instanceof Error ? error.message : 'Erreur lors du traitement du message Telegram'
      console.error('❌ [Telegram API] Erreur générale :', error)
      return jsonResponse({ error: message }, 500)
    }
  },
}
