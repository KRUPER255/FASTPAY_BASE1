import { Link } from 'react-router-dom'
import { Button } from '@/component/ui/button'
import { MessageSquare } from 'lucide-react'

function DemoFrame({
  label,
  borderClass,
}: {
  label: string
  borderClass: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div
        className={`rounded-2xl p-2 min-h-[200px] bg-background ${borderClass}`}
      >
        <div className="rounded-xl border border-border/70 overflow-hidden min-h-[180px] flex flex-col">
          <header className="border-b border-border/40 px-4 py-3 bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Navbar</span>
            </div>
          </header>
          <div className="flex-1 p-4 bg-card/50">
            <p className="text-xs text-muted-foreground">Content area</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BorderStyleDemo() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Border Style Demos</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/v2">Back to Dashboard</Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Compare the 4 thick unique border styles. Pick one to apply to the
          dashboard.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DemoFrame label="Double-line" borderClass="border-demo-double" />
          <DemoFrame label="Gradient" borderClass="border-demo-gradient" />
          <DemoFrame label="Beveled" borderClass="border-demo-bevel" />
          <DemoFrame label="Accent strip" borderClass="border-demo-accent" />
        </div>
      </div>
    </div>
  )
}
