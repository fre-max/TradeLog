import { AppLayout } from '@/components/layout/AppLayout'
import { TelegramButton } from '@/components/trade/TelegramButton'
import { TradeDetail } from '@/components/trade/TradeDetail'
import { TradeDrawer } from '@/components/trade/TradeDrawer'
import { TradeTable } from '@/components/trade/TradeTable'

// ─── Page Journal ─────────────────────────────────────────
// Page principale qui affiche la liste des trades
// Utilise AppLayout pour le Sidebar + Topbar
//-----------------------------------
export default function Journal() {
  return (
    <AppLayout title="Tous Les Trades">
      <TradeTable />

      {/* Drawers — se superposent au contenu */}
      <TradeDrawer />
      <TradeDetail />

      {/* Bouton flottant Telegram (Quick Entry) */}
      <TelegramButton />
    </AppLayout>
  )
}
