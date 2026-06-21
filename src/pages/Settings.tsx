import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useTrades } from '@/hooks/useTrades'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

export default function Settings() {
  const navigate = useNavigate()
  const { data: trades = [] } = useTrades()
  const addToast = useUIStore((state) => state.addToast)
  
  // États pour les différentes sections
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showIncompleteReminder, setShowIncompleteReminder] = useState(true)

  // ─── Déconnexion ────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/auth')
    } catch (error) {
      addToast('Erreur lors de la déconnexion', 'error')
    }
  }

  // ─── Export CSV ────────────────────────────────────────────
  const handleExportCSV = () => {
    if (trades.length === 0) {
      addToast('Aucun trade à exporter', 'error')
      return
    }

    const headers = ['Date', 'Paire', 'Direction', 'Session', 'R:R Prévu', 'R:R Réalisé', 'Résultat', 'Statut', 'Émotion']
    const rows = trades.map(t => [
      t.date_backtested,
      t.pair,
      t.direction,
      t.session,
      t.rr_planned ?? '',
      t.rr_realized ?? '',
      t.result ?? '',
      t.status,
      t.emotion ?? ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tradelog_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    addToast('Export CSV réussi !', 'success')
  }

  // ─── Test Telegram ──────────────────────────────────────────
  const handleTestTelegram = async () => {
    if (!telegramToken.trim()) {
      addToast('Veuillez entrer un token Telegram', 'error')
      return
    }

    setTelegramStatus('testing')
    try {
      // Le token Telegram est géré côté serveur par Supabase Edge Functions.
      // On teste juste que la fonction est accessible et que le serveur a bien le token.
      const { data, error } = await supabase.functions.invoke('telegram', {
        body: { ping: true }
      })
      
      if (!error && data?.ok) {
        setTelegramStatus('success')
        addToast('Connexion Telegram réussie !', 'success')
      } else {
        setTelegramStatus('error')
        addToast(error?.message || data?.error || 'Erreur de connexion Telegram', 'error')
      }
    } catch (error) {
      setTelegramStatus('error')
      addToast('Erreur lors du test Telegram', 'error')
    }
  }

  // ─── Toggle Dark Mode ────────────────────────────────────────
  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    if (!isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    addToast(`Thème ${isDarkMode ? 'clair' : 'sombre'} activé`, 'success')
  }

  // ─── Rappel trades incomplets ────────────────────────────────
  const incompleteTrades = trades.filter(t => t.status === 'in_progress' || t.status === 'quick').length

  return (
    <AppLayout title="Paramètres">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl">
        
        {/* Section Compte */}
        <Section title="👤 Compte">
          <SettingRow
            label="Déconnexion"
            description="Se déconnecter de votre compte"
            action={
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-loss/10 text-loss rounded-md text-[13px] font-medium hover:bg-loss/20 transition-colors"
              >
                Se déconnecter
              </button>
            }
          />
        </Section>

        {/* Section Données */}
        <Section title="📊 Données">
          <SettingRow
            label="Export CSV"
            description={`Exporter ${trades.length} trade(s) au format CSV`}
            action={
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors"
              >
                Exporter
              </button>
            }
          />
        </Section>

        {/* Section Telegram */}
        <Section title="📱 Configuration Telegram">
          <div className="space-y-4">
            <div>
              <label className="block text-txt text-[13px] font-medium mb-2">Token du bot Telegram</label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="Entrez votre token Telegram..."
                className="w-full px-3 py-2 bg-bg border border-border rounded-md text-[13px] text-txt placeholder-txt3 focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleTestTelegram}
              disabled={telegramStatus === 'testing'}
              className={cn(
                'px-4 py-2 rounded-md text-[13px] font-medium transition-colors',
                telegramStatus === 'testing' ? 'bg-txt3 text-txt cursor-not-allowed' :
                telegramStatus === 'success' ? 'bg-win/10 text-win' :
                telegramStatus === 'error' ? 'bg-loss/10 text-loss' :
                'bg-accent text-white hover:bg-accent/90'
              )}
            >
              {telegramStatus === 'testing' ? 'Test en cours...' :
               telegramStatus === 'success' ? '✓ Connexion réussie' :
               telegramStatus === 'error' ? '✗ Erreur' :
               'Tester la connexion'}
            </button>
            <p className="text-txt3 text-[12px]">
              💡 Pour obtenir un token, créez un bot via @BotFather sur Telegram
            </p>
          </div>
        </Section>

        {/* Section Apparence */}
        <Section title="🎨 Apparence">
          <SettingRow
            label="Thème sombre"
            description="Activer le mode sombre de l'application"
            action={
              <button
                onClick={handleToggleDarkMode}
                className={cn(
                  'w-12 h-6 rounded-full relative transition-colors',
                  isDarkMode ? 'bg-accent' : 'bg-surface2'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                    isDarkMode ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            }
          />
        </Section>

        {/* Section Rappels */}
        <Section title="🔔 Rappels">
          <SettingRow
            label="Trades incomplets"
            description={`${incompleteTrades} trade(s) en cours`}
            action={
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[13px] font-medium',
                  incompleteTrades > 0 ? 'text-accent' : 'text-txt3'
                )}>
                  {incompleteTrades} incomplet(s)
                </span>
              </div>
            }
          />
        </Section>

      </div>
    </AppLayout>
  )
}

// ─── Composants helpers ───────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-txt text-[14px] font-semibold">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SettingRow({ 
  label, 
  description, 
  action 
}: { 
  label: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-txt text-[13.5px] font-medium">{label}</p>
        <p className="text-txt3 text-[12px]">{description}</p>
      </div>
      {action}
    </div>
  )
}
