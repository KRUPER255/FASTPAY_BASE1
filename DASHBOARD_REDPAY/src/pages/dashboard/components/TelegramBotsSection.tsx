import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import { useToast } from '@/lib/use-toast'
import { Label } from '@/component/ui/label'
import { Textarea } from '@/component/ui/textarea'
import { Switch } from '@/component/ui/switch'
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
import {
  Bot,
  Plus,
  Trash2,
  Edit,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader,
  Search,
  ExternalLink,
  Copy,
  MessageSquare,
  Users,
  Hash,
  Radio,
} from 'lucide-react'
import {
  listTelegramBots,
  createTelegramBot,
  updateTelegramBot,
  deleteTelegramBot,
  validateToken,
  sendTestMessage,
  syncBotInfo,
  discoverChatsByToken,
  lookupChatByToken,
  type TelegramBot,
  type TelegramBotCreate,
} from '@/lib/telegram-api'

interface TelegramBotsSectionProps {
  isAdmin: boolean
}

const CHAT_TYPE_ICONS: Record<string, React.ElementType> = {
  personal: MessageSquare,
  group: Users,
  supergroup: Hash,
  channel: Radio,
}

export function TelegramBotsSection({ isAdmin }: TelegramBotsSectionProps) {
  const { toast } = useToast()
  
  // State
  const [bots, setBots] = useState<TelegramBot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBot, setSelectedBot] = useState<TelegramBot | null>(null)
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState<TelegramBotCreate>({
    name: '',
    token: '',
    chat_ids: [],
    chat_type: 'channel',
    description: '',
    is_active: true,
  })
  const [chatIdInput, setChatIdInput] = useState('')
  const [testMessage, setTestMessage] = useState('Test message from FastPay Dashboard')
  const [validatingToken, setValidatingToken] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [botInfo, setBotInfo] = useState<{ username?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  
  // Discovery states
  const [discovering, setDiscovering] = useState(false)
  const [discoveredChats, setDiscoveredChats] = useState<Array<{ chat_id: string; title: string; type: string }>>([])
  const [lookupUsername, setLookupUsername] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  // Load bots
  const loadBots = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listTelegramBots()
      setBots(response.results as TelegramBot[])
    } catch (error) {
      console.error('Failed to load bots:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load Telegram bots',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      token: '',
      chat_ids: [],
      chat_type: 'channel',
      description: '',
      is_active: true,
    })
    setChatIdInput('')
    setTokenValid(null)
    setBotInfo(null)
    setDiscoveredChats([])
    setLookupUsername('')
  }

  // Validate token
  const handleValidateToken = async () => {
    if (!formData.token) return
    
    setValidatingToken(true)
    setTokenValid(null)
    setBotInfo(null)
    
    try {
      const result = await validateToken(formData.token)
      setTokenValid(result.valid)
      if (result.valid && result.bot) {
        setBotInfo({ username: result.bot.username })
        toast({
          title: 'Token Valid',
          description: `Bot: @${result.bot.username}`,
        })
      } else {
        toast({
          title: 'Invalid Token',
          description: result.error || 'Token validation failed',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setTokenValid(false)
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Failed to validate token',
        variant: 'destructive',
      })
    } finally {
      setValidatingToken(false)
    }
  }

  // Discover chats
  const handleDiscoverChats = async () => {
    if (!formData.token) return
    
    setDiscovering(true)
    setDiscoveredChats([])
    
    try {
      const result = await discoverChatsByToken(formData.token)
      setDiscoveredChats(result.chats)
      if (result.chats.length === 0) {
        toast({
          title: 'No Chats Found',
          description: 'Add the bot to a group/channel or start a conversation first',
        })
      } else {
        toast({
          title: 'Chats Discovered',
          description: `Found ${result.chats.length} chat(s)`,
        })
      }
    } catch (error) {
      toast({
        title: 'Discovery Failed',
        description: error instanceof Error ? error.message : 'Failed to discover chats',
        variant: 'destructive',
      })
    } finally {
      setDiscovering(false)
    }
  }

  // Lookup chat by username
  const handleLookupChat = async () => {
    if (!formData.token || !lookupUsername) return
    
    setLookingUp(true)
    
    try {
      const result = await lookupChatByToken(formData.token, lookupUsername)
      if (result.success && result.chat) {
        // Add to chat_ids
        const newChatIds = [...(formData.chat_ids || []), result.chat.chat_id]
        setFormData({ ...formData, chat_ids: newChatIds, chat_type: result.chat.type as any })
        toast({
          title: 'Chat Found',
          description: `${result.chat.title} (${result.chat.chat_id})`,
        })
        setLookupUsername('')
      } else {
        toast({
          title: 'Chat Not Found',
          description: result.error || 'Could not find chat',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Lookup Failed',
        description: error instanceof Error ? error.message : 'Failed to lookup chat',
        variant: 'destructive',
      })
    } finally {
      setLookingUp(false)
    }
  }

  // Add chat ID
  const handleAddChatId = () => {
    if (!chatIdInput.trim()) return
    const newChatIds = [...(formData.chat_ids || []), chatIdInput.trim()]
    setFormData({ ...formData, chat_ids: newChatIds })
    setChatIdInput('')
  }

  // Remove chat ID
  const handleRemoveChatId = (index: number) => {
    const newChatIds = [...(formData.chat_ids || [])]
    newChatIds.splice(index, 1)
    setFormData({ ...formData, chat_ids: newChatIds })
  }

  // Create bot
  const handleCreate = async () => {
    if (!formData.name || !formData.token) {
      toast({
        title: 'Validation Error',
        description: 'Name and token are required',
        variant: 'destructive',
      })
      return
    }
    
    setSaving(true)
    try {
      await createTelegramBot(formData)
      toast({
        title: 'Bot Created',
        description: `${formData.name} has been created`,
      })
      setShowCreateDialog(false)
      resetForm()
      loadBots()
    } catch (error) {
      toast({
        title: 'Create Failed',
        description: error instanceof Error ? error.message : 'Failed to create bot',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Update bot
  const handleUpdate = async () => {
    if (!selectedBot) return
    
    setSaving(true)
    try {
      await updateTelegramBot(selectedBot.id, formData)
      toast({
        title: 'Bot Updated',
        description: `${formData.name} has been updated`,
      })
      setShowEditDialog(false)
      resetForm()
      loadBots()
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update bot',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete bot
  const handleDelete = async () => {
    if (!selectedBot) return
    
    setSaving(true)
    try {
      await deleteTelegramBot(selectedBot.id)
      toast({
        title: 'Bot Deleted',
        description: `${selectedBot.name} has been deleted`,
      })
      setShowDeleteDialog(false)
      setSelectedBot(null)
      loadBots()
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete bot',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Test message
  const handleTest = async () => {
    if (!selectedBot) return
    
    setTesting(true)
    try {
      const result = await sendTestMessage(selectedBot.id, { message: testMessage })
      if (result.overall_success) {
        toast({
          title: 'Test Successful',
          description: 'Message sent to all chat IDs',
        })
      } else if (result.partial_success) {
        toast({
          title: 'Partial Success',
          description: 'Some messages failed to send',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Test Failed',
          description: result.results[0]?.error || 'Failed to send test message',
          variant: 'destructive',
        })
      }
      setShowTestDialog(false)
      loadBots() // Refresh to update message count
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Failed to send test message',
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  // Sync info
  const handleSync = async (bot: TelegramBot) => {
    setSyncing(true)
    try {
      const result = await syncBotInfo(bot.id)
      if (result.success) {
        toast({
          title: 'Sync Complete',
          description: `Updated: ${Object.keys(result.updates).join(', ') || 'No changes'}`,
        })
        loadBots()
      } else {
        toast({
          title: 'Sync Failed',
          description: result.errors?.join(', ') || 'Failed to sync info',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync info',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Open edit dialog
  const openEditDialog = (bot: TelegramBot) => {
    setSelectedBot(bot)
    setFormData({
      name: bot.name,
      token: bot.token,
      chat_ids: bot.chat_ids || [],
      chat_type: bot.chat_type,
      message_thread_id: bot.message_thread_id,
      chat_title: bot.chat_title,
      chat_username: bot.chat_username,
      description: bot.description || '',
      is_active: bot.is_active,
    })
    setShowEditDialog(true)
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    })
  }

  // Render bot card
  const renderBotCard = (bot: TelegramBot) => {
    const ChatTypeIcon = CHAT_TYPE_ICONS[bot.chat_type] || Radio
    
    return (
      <Card key={bot.id} className="relative">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{bot.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={bot.is_active ? 'default' : 'secondary'}>
                {bot.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <ChatTypeIcon className="h-3 w-3" />
                {bot.chat_type_display}
              </Badge>
            </div>
          </div>
          {bot.description && (
            <CardDescription>{bot.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Bot info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Bot:</span>{' '}
                {bot.bot_username ? (
                  <a
                    href={`https://t.me/${bot.bot_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    @{bot.bot_username}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not synced</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Messages:</span>{' '}
                {bot.message_count}
              </div>
            </div>
            
            {/* Chat info */}
            {bot.chat_title && (
              <div className="text-sm">
                <span className="text-muted-foreground">Target:</span>{' '}
                {bot.chat_title}
                {bot.chat_username && (
                  <span className="text-muted-foreground"> ({bot.chat_username})</span>
                )}
              </div>
            )}
            
            {/* Chat IDs */}
            {bot.chat_ids && bot.chat_ids.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bot.chat_ids.slice(0, 3).map((chatId, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-mono">
                    {chatId}
                  </Badge>
                ))}
                {bot.chat_ids.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{bot.chat_ids.length - 3} more
                  </Badge>
                )}
              </div>
            )}
            
            {/* Token */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Token: {bot.masked_token}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => copyToClipboard(bot.token)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Last used */}
            {bot.last_used_at && (
              <div className="text-xs text-muted-foreground">
                Last used: {new Date(bot.last_used_at).toLocaleString()}
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedBot(bot)
                  setShowTestDialog(true)
                }}
                disabled={!bot.is_active || (bot.chat_ids?.length || 0) === 0}
              >
                <Send className="h-4 w-4 mr-1" />
                Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync(bot)}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditDialog(bot)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedBot(bot)
                  setShowDeleteDialog(true)
                }}
              >
                <Trash2 className="h-4 w-4 mr-1 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render form fields
  const renderFormFields = () => (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Payment Alerts"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      
      {/* Token */}
      <div className="space-y-2">
        <Label htmlFor="token">Bot Token *</Label>
        <div className="flex gap-2">
          <Input
            id="token"
            placeholder="123456789:ABCdefGHI..."
            value={formData.token}
            onChange={(e) => {
              setFormData({ ...formData, token: e.target.value })
              setTokenValid(null)
              setBotInfo(null)
            }}
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleValidateToken}
            disabled={!formData.token || validatingToken}
          >
            {validatingToken ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : tokenValid === true ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : tokenValid === false ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              'Validate'
            )}
          </Button>
        </div>
        {botInfo?.username && (
          <p className="text-sm text-muted-foreground">Bot: @{botInfo.username}</p>
        )}
      </div>
      
      {/* Chat Type */}
      <div className="space-y-2">
        <Label>Chat Type</Label>
        <Select
          value={formData.chat_type}
          onValueChange={(v) => setFormData({ ...formData, chat_type: v as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="channel">Channel</SelectItem>
            <SelectItem value="group">Group</SelectItem>
            <SelectItem value="supergroup">Supergroup</SelectItem>
            <SelectItem value="personal">Personal Chat</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Chat ID Discovery */}
      <div className="space-y-2">
        <Label>Chat IDs</Label>
        
        {/* Lookup by username */}
        <div className="flex gap-2">
          <Input
            placeholder="@channel_username"
            value={lookupUsername}
            onChange={(e) => setLookupUsername(e.target.value)}
            disabled={!formData.token}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleLookupChat}
            disabled={!formData.token || !lookupUsername || lookingUp}
          >
            {lookingUp ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscoverChats}
            disabled={!formData.token || discovering}
          >
            {discovering ? <Loader className="h-4 w-4 animate-spin" /> : 'Discover'}
          </Button>
        </div>
        
        {/* Discovered chats */}
        {discoveredChats.length > 0 && (
          <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
            {discoveredChats.map((chat, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-1 hover:bg-muted rounded cursor-pointer"
                onClick={() => {
                  const newChatIds = [...(formData.chat_ids || []), chat.chat_id]
                  setFormData({ ...formData, chat_ids: newChatIds, chat_type: chat.type as any })
                }}
              >
                <span className="text-sm">{chat.title}</span>
                <Badge variant="outline" className="text-xs">{chat.type}</Badge>
              </div>
            ))}
          </div>
        )}
        
        {/* Manual input */}
        <div className="flex gap-2">
          <Input
            placeholder="Manual chat ID (e.g., -1001234567890)"
            value={chatIdInput}
            onChange={(e) => setChatIdInput(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={handleAddChatId}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Chat IDs list */}
        {formData.chat_ids && formData.chat_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {formData.chat_ids.map((chatId, i) => (
              <Badge key={i} variant="secondary" className="font-mono">
                {chatId}
                <button
                  type="button"
                  className="ml-1 hover:text-destructive"
                  onClick={() => handleRemoveChatId(i)}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="What is this bot used for?"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>
      
      {/* Active */}
      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Telegram Bots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Telegram Bots
              </CardTitle>
              <CardDescription>
                Manage Telegram bot credentials for notifications
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadBots}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bot
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bot list */}
      {bots.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Telegram Bots</h3>
              <p className="text-muted-foreground mb-4">
                Add a Telegram bot to send notifications
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Bot
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bots.map(renderBotCard)}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Telegram Bot</DialogTitle>
            <DialogDescription>
              Add a new Telegram bot for sending notifications.
              Get your bot token from @BotFather.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !formData.name || !formData.token}>
              {saving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Telegram Bot</DialogTitle>
            <DialogDescription>
              Update bot configuration.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Message</DialogTitle>
            <DialogDescription>
              Send a test message using {selectedBot?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
              />
            </div>
            {selectedBot?.chat_ids && (
              <div className="text-sm text-muted-foreground">
                Sending to: {selectedBot.chat_ids.join(', ')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleTest} disabled={testing}>
              {testing ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedBot?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
