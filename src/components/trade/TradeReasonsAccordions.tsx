import { useState } from 'react'
import { useReasonFamilies } from '@/hooks/useReasonFamilies'
import { useCatalog } from '@/hooks/useCatalog'
import { cn } from '@/lib/utils'

interface TradeReasonsAccordionsProps {
  selectedReasonIds: string[]
  onChange: (newIds: string[]) => void
}

export function TradeReasonsAccordions({ selectedReasonIds, onChange }: TradeReasonsAccordionsProps) {
  const { data: families, isLoading: loadingFamilies } = useReasonFamilies()
  const { data: catalogItems, isLoading: loadingCatalog } = useCatalog()
  
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null)

  if (loadingFamilies || loadingCatalog) {
    return <div className="text-xs text-txt3 animate-pulse">Chargement des raisons...</div>
  }

  if (!families || families.length === 0) {
    return <div className="text-xs text-txt3">Aucune famille de raisons configurée dans le catalogue.</div>
  }

  const toggleReason = (reasonId: string) => {
    if (selectedReasonIds.includes(reasonId)) {
      onChange(selectedReasonIds.filter(id => id !== reasonId))
    } else {
      onChange([...selectedReasonIds, reasonId])
    }
  }

  return (
    <div className="space-y-2">
      {families.map(family => {
        const familyReasons = catalogItems?.filter(item => item.family_id === family.id) || []
        const selectedCount = familyReasons.filter(r => selectedReasonIds.includes(r.id)).length
        const isOpen = openFamilyId === family.id

        return (
          <div key={family.id} className="border border-border2 rounded-lg bg-surface overflow-hidden transition-all">
            {/* Header / Accordion Toggle */}
            <button
              type="button"
              onClick={() => setOpenFamilyId(isOpen ? null : family.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface2 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-txt">{family.name}</span>
                {selectedCount > 0 && (
                  <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {selectedCount} sélectionné(s)
                  </span>
                )}
              </div>
              <span className={cn('text-txt3 transition-transform', isOpen && 'rotate-180')}>
                ▼
              </span>
            </button>

            {/* Content / Reasons List */}
            {isOpen && (
              <div className="p-3 bg-bg border-t border-border2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {familyReasons.length === 0 ? (
                  <div className="text-xs text-txt3 col-span-full py-2">Aucune raison dans cette famille.</div>
                ) : (
                  familyReasons.map(reason => {
                    const isSelected = selectedReasonIds.includes(reason.id)
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => toggleReason(reason.id)}
                        className={cn(
                          'flex items-start text-left gap-2 p-2 rounded-md border transition-all',
                          isSelected 
                            ? 'bg-accent/10 border-accent/40 text-accent' 
                            : 'bg-surface border-border2 text-txt2 hover:border-accent/30 hover:bg-surface2'
                        )}
                      >
                        <div className={cn(
                          'mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                          isSelected ? 'bg-accent border-accent text-white' : 'border-border3'
                        )}>
                          {isSelected && <span className="text-[10px]">✓</span>}
                        </div>
                        <div className="flex flex-col">
                          <span className={cn('text-[13px] font-medium leading-tight', isSelected ? 'text-accent' : 'text-txt')}>
                            {reason.title}
                          </span>
                          {reason.description && (
                            <span className="text-[11px] opacity-70 line-clamp-1 mt-0.5">
                              {reason.description}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
