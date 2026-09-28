import type { ReactNode } from 'react'

export function ToolbarTip({
  label,
  shortcut,
  children,
}: {
  label: string
  shortcut?: string
  children: ReactNode
}) {
  return (
    <div className="relative group/tip">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100"
      >
        <span className="font-medium">{label}</span>
        {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
      </div>
    </div>
  )
}
