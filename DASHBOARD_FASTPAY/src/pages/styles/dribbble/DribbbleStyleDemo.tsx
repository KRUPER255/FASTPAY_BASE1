import { DribbbleStyleCard, DribbbleStyleCardStagger } from '@/component/DribbbleStyleCard'
import { ArrowRight, Zap, Shield, PieChart } from 'lucide-react'

export default function DribbbleStyleDemo() {
  const features = [
    { icon: Zap, label: 'Smooth entrance', desc: 'Fade, slide up and scale in' },
    { icon: Shield, label: 'Hover lift', desc: 'Card lifts with shadow on hover' },
    { icon: PieChart, label: 'Staggered list', desc: 'Items animate in sequence' },
  ]

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dribbble-style card</h1>
          <p className="text-muted-foreground">
            Animated card component: entrance animation, hover lift, and optional staggered content.
          </p>
        </div>

        {/* Single card with custom content */}
        <DribbbleStyleCard>
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-1">Welcome</h2>
            <p className="text-muted-foreground text-sm mb-4">
              This card fades in, slides up and scales in. Hover to see the lift effect.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </DribbbleStyleCard>

        {/* Card with staggered list */}
        <DribbbleStyleCard delay={0.15}>
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-4">Features</h2>
            <DribbbleStyleCardStagger
              items={features.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 py-2 px-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-muted-foreground text-xs">{desc}</div>
                  </div>
                </div>
              ))}
            />
          </div>
        </DribbbleStyleCard>

        {/* Grid of small cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <DribbbleStyleCard key={i} delay={0.25 + i * 0.08}>
              <div className="p-5">
                <div className="text-sm font-medium mb-1">Card {i + 1}</div>
                <p className="text-muted-foreground text-xs">
                  Each card has a slight delay for a staggered grid effect.
                </p>
              </div>
            </DribbbleStyleCard>
          ))}
        </div>
      </div>
    </div>
  )
}
