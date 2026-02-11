import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/component/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import { LayoutTemplate, Wrench } from 'lucide-react'
import TemplateManager from '@/component/TemplateManager'

interface UtilitiesSectionProps {
  deviceId?: string | null
}

export function UtilitiesSection({ deviceId }: UtilitiesSectionProps) {
  const [activeUtility, setActiveUtility] = useState<string>('templates')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5" />
            Utilities
          </CardTitle>
          <CardDescription>
            Manage templates and operational tools with a consistent workspace layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <Tabs value={activeUtility} onValueChange={setActiveUtility} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:max-w-[360px]">
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4" />
                Templates
              </TabsTrigger>
              {/* Add more utility tabs here in the future */}
            </TabsList>

            <TabsContent value="templates" className="mt-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-foreground">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  Template Manager
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Create, manage, and apply templates for instruction cards, notifications, SMS, and more.
                </p>
                <TemplateManager
                  deviceId={deviceId || undefined}
                  onApply={(template) => {
                    console.log('Template applied:', template)
                  }}
                />
              </div>
            </TabsContent>

            {/* Add more utility tabs content here in the future */}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
