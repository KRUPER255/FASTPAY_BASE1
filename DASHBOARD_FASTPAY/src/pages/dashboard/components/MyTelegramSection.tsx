import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Label } from '@/component/ui/label'
import { Switch } from '@/component/ui/switch'
import { Skeleton } from '@/component/ui/skeleton'
import { useToast } from '@/lib/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/component/ui/dialog'
import { MessageSquare, Plus, Trash2, Loader, Copy, ExternalLink } from 'lucide-react'
import {
  listTelegramLinks,
  createTelegramLink,
  updateTelegramLink,
  deleteTelegramLink,
  listTelegramBots,
  type TelegramUserLink,
  type TelegramBotListItem,
} from '@/lib/telegram-api'

interface MyTelegramSectionProps {
  userEmail: string | null
}

export function MyTelegramSection({ userEmail }: MyTelegramSectionProps) {
  const { toast } = useToast()
  const [links, setLinks] = useState<TelegramUserLink[]>([])
  const [bots, setBots] = useState<TelegramBotListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [selectedBotId, setSelectedBotId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{
    link_token: string
    expires_at: string
    deep_link: string | null
    bot_username: string | null
  } | null>(null)

  const loadData = useCallback(async () => {
    if (!userEmail) {
      setLinks([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [linksRes, botsRes] = await Promise.all([
        listTelegramLinks(userEmail),
        listTelegramBots({ dropdown: true }),
      ])
      setLinks(linksRes.results || [])
      setBots((botsRes.results || []) as TelegramBotListItem[])
    } catch (error) {
      console.error('Failed to load Telegram links:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load Telegram links',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [userEmail, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleConnect = async () => {
    if (!userEmail || !selectedBotId) return
    setCreating(true)
    setCreateResult(null)
    try {
      const res = await createTelegramLink(userEmail, parseInt(selectedBotId, 10))
      setCreateResult({
        link_token: res.link_token,
        expires_at: res.expires_at,
        deep_link: res.deep_link,
        bot_username: res.bot_username,
      })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create link',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleCopyToken = () => {
    if (createResult?.link_token) {
      navigator.clipboard.writeText(createResult.link_token)
      toast({ title: 'Copied', description: 'Link token copied to clipboard' })
    }
  }

  const handleToggle = async (link: TelegramUserLink, field: 'opted_in_alerts' | 'opted_in_reports' | 'opted_in_device_events', value: boolean) => {
    try {
      await updateTelegramLink(link.id, { [field]: value })
      toast({ title: 'Updated', description: 'Preferences saved' })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      })
    }
  }

  const handleDisconnect = async (id: number) => {
    try {
      await deleteTelegramLink(id)
      toast({ title: 'Disconnected', description: 'Telegram link removed' })
      loadData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect',
        variant: 'destructive',
      })
    }
  }

  if (!userEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            My Telegram
          </CardTitle>
          <CardDescription>Sign in to link your Telegram chat for notifications.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              My Telegram
            </CardTitle>
            <CardDescription>
              Link your Telegram chat to receive alerts and device notifications for your company.
            </CardDescription>
          </div>
          <Button onClick={() => { setShowConnectDialog(true); setCreateResult(null); setSelectedBotId(''); }}>
            <Plus className="h-4 w-4 mr-2" />
            Connect Telegram
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : links.length === 0 ? (
            <p className="text-muted-foreground text-sm">No Telegram chat linked. Click &quot;Connect Telegram&quot; and send /link &lt;token&gt; to your bot.</p>
          ) : (
            <ul className="space-y-4">
              {links.map((link) => (
                <li key={link.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {link.telegram_chat_id ? `Chat linked (${link.telegram_chat_id})` : 'Pending link'}
                    </span>
                    <span className="text-sm text-muted-foreground">Bot: {link.telegram_bot_name}</span>
                    <Button variant="outline" size="sm" onClick={() => handleDisconnect(link.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`alerts-${link.id}`}
                        checked={link.opted_in_alerts}
                        onCheckedChange={(v) => handleToggle(link, 'opted_in_alerts', v)}
                      />
                      <Label htmlFor={`alerts-${link.id}`}>Alerts</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`reports-${link.id}`}
                        checked={link.opted_in_reports}
                        onCheckedChange={(v) => handleToggle(link, 'opted_in_reports', v)}
                      />
                      <Label htmlFor={`reports-${link.id}`}>Reports</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`device-${link.id}`}
                        checked={link.opted_in_device_events}
                        onCheckedChange={(v) => handleToggle(link, 'opted_in_device_events', v)}
                      />
                      <Label htmlFor={`device-${link.id}`}>Device events</Label>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
            <DialogDescription>
              {createResult
                ? 'Send the token below to your bot in Telegram to complete linking.'
                : 'Choose a bot and we will generate a one-time link token. You have 15 minutes to send /link &lt;token&gt; to the bot.'}
            </DialogDescription>
          </DialogHeader>
          {!createResult ? (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Bot</Label>
                <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {bots.map((bot) => (
                      <SelectItem key={bot.id} value={String(bot.id)}>
                        {bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Link token (send this to the bot)</Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-sm break-all">
                    {createResult.link_token}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopyToken}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {createResult.deep_link && (
                <div className="grid gap-2">
                  <Label>Or open this link and send: /link {createResult.link_token}</Label>
                  <a
                    href={createResult.deep_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline flex items-center gap-1"
                  >
                    {createResult.deep_link}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                In Telegram, open the bot and send: <strong>/link {createResult.link_token}</strong>
              </p>
            </div>
          )}
          <DialogFooter>
            {!createResult ? (
              <>
                <Button variant="outline" onClick={() => setShowConnectDialog(false)}>Cancel</Button>
                <Button onClick={handleConnect} disabled={creating || !selectedBotId}>
                  {creating ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate token
                </Button>
              </>
            ) : (
              <Button onClick={() => { setShowConnectDialog(false); setCreateResult(null); }}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
