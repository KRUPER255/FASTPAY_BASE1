import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Label } from '@/component/ui/label'
import { useToast } from '@/lib/use-toast'
import { Skeleton } from '@/component/ui/skeleton'
import { FileSpreadsheet, Upload, Loader2 } from 'lucide-react'
import {
  getSheetWorkerProcesses,
  runSheetWorkerProcess,
  type SheetWorkerProcess,
} from '@/lib/sheet-worker-api'

export interface SheetWorkerSectionProps {
  sessionEmail?: string | null
}

export function SheetWorkerSection({ sessionEmail }: SheetWorkerSectionProps) {
  const { toast } = useToast()
  const [processes, setProcesses] = useState<SheetWorkerProcess[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SheetWorkerProcess | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state: file upload
  const [file, setFile] = useState<File | null>(null)
  // Form state: sheet link
  const [sheetLink, setSheetLink] = useState('')
  const [range, setRange] = useState('')
  const [userEmail, setUserEmail] = useState(sessionEmail ?? '')

  const loadProcesses = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getSheetWorkerProcesses()
      setProcesses(list)
      if (list.length > 0 && !selected) setSelected(list[0])
    } catch (e) {
      toast({
        title: 'Failed to load processes',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, selected])

  useEffect(() => {
    loadProcesses()
  }, [loadProcesses])

  useEffect(() => {
    setUserEmail(prev => sessionEmail ?? prev)
  }, [sessionEmail])

  const handleSubmit = async () => {
    if (!selected) return
    if (selected.input_type === 'file' && !file) {
      toast({ title: 'Select a file', variant: 'destructive' })
      return
    }
    if (selected.input_type === 'sheet_link') {
      const linkOrId = (sheetLink || '').trim()
      if (!linkOrId) {
        toast({ title: 'Enter Google Sheet URL or ID', variant: 'destructive' })
        return
      }
      if (!userEmail) {
        toast({ title: 'Your email is required for Google Sheet', variant: 'destructive' })
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await runSheetWorkerProcess({
        process_id: selected.id,
        user_email: userEmail || undefined,
        file: file ?? undefined,
        sheet_link: selected.input_type === 'sheet_link' ? (sheetLink || undefined) : undefined,
        spreadsheet_id: selected.input_type === 'sheet_link' ? (sheetLink || undefined) : undefined,
        range: range || undefined,
      })

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/vnd.openxmlformats') || contentType.includes('application/octet-stream')) {
        const blob = await res.blob()
        const disp = res.headers.get('Content-Disposition')
        let filename = 'export.xlsx'
        if (disp) {
          const m = disp.match(/filename="?([^";]+)"?/)
          if (m) filename = m[1].trim()
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: 'Download started', description: filename })
      } else {
        const text = await res.text()
        let data: { error?: string; download_url?: string } = {}
        try {
          data = JSON.parse(text)
        } catch {
          data = { error: text || res.statusText }
        }
        if (data.download_url) {
          window.open(data.download_url, '_blank')
          toast({ title: 'Download', description: 'Opened in new tab' })
        } else {
          toast({
            title: res.ok ? 'Done' : 'Error',
            description: data.error || text || res.statusText,
            variant: res.ok ? 'default' : 'destructive',
          })
        }
      }
    } catch (e) {
      toast({
        title: 'Request failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Sheet worker
        </CardTitle>
        <CardDescription>
          Choose a process, provide the required input (file or Google Sheet link), then run to get an Excel file or download.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full sm:w-56 shrink-0 space-y-2">
          <Label className="text-muted-foreground">Available functions</Label>
          <ul className="rounded-lg border border-border/50 divide-y divide-border/50 overflow-hidden">
            {processes.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(p)
                    setFile(null)
                    setSheetLink('')
                    setRange('')
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors ${
                    selected?.id === p.id
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {p.input_type === 'file' && <Upload className="inline h-4 w-4 mr-2 align-middle" />}
                  {p.input_type === 'sheet_link' && <FileSpreadsheet className="inline h-4 w-4 mr-2 align-middle" />}
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {selected && (
            <>
              {selected.description && (
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              )}
              {selected.input_type === 'file' && (
                <div className="space-y-2">
                  <Label htmlFor="sheet-worker-file">File</Label>
                  <Input
                    id="sheet-worker-file"
                    type="file"
                    accept={selected.accept || '.zip'}
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              {selected.input_type === 'sheet_link' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sheet-worker-link">Google Sheet URL or ID</Label>
                    <Input
                      id="sheet-worker-link"
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/... or spreadsheet ID"
                      value={sheetLink}
                      onChange={e => setSheetLink(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sheet-worker-range">Range (optional, e.g. Sheet1!A:ZZ)</Label>
                    <Input
                      id="sheet-worker-range"
                      type="text"
                      placeholder="Sheet1!A:ZZ"
                      value={range}
                      onChange={e => setRange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sheet-worker-email">Your email (connected Google account)</Label>
                    <Input
                      id="sheet-worker-email"
                      type="email"
                      placeholder="user@example.com"
                      value={userEmail}
                      onChange={e => setUserEmail(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Button
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  'Run'
                )}
              </Button>
            </>
          )}
          {!selected && processes.length === 0 && (
            <p className="text-sm text-muted-foreground">No processes available.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
