import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Journal from '@/pages/Journal'
import Stats from '@/pages/Stats'
import Settings from '@/pages/Settings'
import Auth from '@/pages/Auth'
import Catalog from '@/pages/Catalog'
import { ToastContainer } from '@/components/ui/Toast'
import { BrouillonButton } from '@/components/trade/BrouillonButton'

// Configuration de TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min de cache
      retry: 1,
    },
  },
})

// Restaure la préférence de thème dès le démarrage (avant le premier rendu React)
// Sans ça, le thème se réinitialise au sombre à chaque refresh de page
const themeEnregistre = localStorage.getItem('theme')
if (themeEnregistre === 'light') {
  document.documentElement.classList.add('light')
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  // Écouter les changements d'authentification Supabase
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error) => {
        console.error('❌ [Supabase] Erreur session:', error)
        setSession(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Écran de chargement pendant la vérification de session
  if (session === undefined) {
    return (
      <div className="h-screen bg-bg flex items-center justify-center text-txt3 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-semibold text-sm animate-pulse">TL</div>
          <span>Chargement...</span>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Routes protégées — redirigent vers /auth si non connecté */}
          <Route
            path="/"
            element={session ? <Journal /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/journal/:type"
            element={session ? <Journal /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/stats"
            element={session ? <Stats /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/settings"
            element={session ? <Settings /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/catalog"
            element={session ? <Catalog /> : <Navigate to="/auth" replace />}
          />

          {/* Auth — redirige vers / si déjà connecté */}
          <Route
            path="/auth"
            element={!session ? <Auth /> : <Navigate to="/" replace />}
          />
        </Routes>

        {/* Toasts globaux — visibles sur toutes les pages */}
        <ToastContainer />

        {/* Bouton brouillons — visible seulement si l'utilisateur est connecté */}
        {session && <BrouillonButton />}
      </BrowserRouter>
    </QueryClientProvider>
  )
}
