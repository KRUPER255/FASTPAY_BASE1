import { useState, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/component/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/component/ui/table'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import { FeatureGate } from '@/component/FeatureGate'
import { SearchInput } from '@/component/SearchInput'
import type { FilterMode } from '@/component/SearchInput'
import { Contact, Wifi, WifiOff, Loader, X, Check, Bookmark } from 'lucide-react'
import type { Contact as ContactType } from '../types'

interface ContactsSectionProps {
  deviceId: string | null
  contacts: ContactType[]
  loading: boolean
  error: string | null
  isConnected: boolean
  isAdmin: boolean
  syncEnabled: boolean
  onRetry?: () => void
}

export function ContactsSection({
  deviceId,
  contacts,
  loading,
  error,
  isConnected,
  isAdmin,
  syncEnabled,
  onRetry,
}: ContactsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilterMode, setSearchFilterMode] = useState<FilterMode>('contains')
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null)

  // Helper function to match search filter modes
  const matchesSearchFilter = (text: string, query: string, mode: FilterMode) => {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    switch (mode) {
      case 'equals':
        return lowerText === lowerQuery
      case 'contains':
        return lowerText.includes(lowerQuery)
      case 'startsWith':
        return lowerText.startsWith(lowerQuery)
      case 'endsWith':
        return lowerText.endsWith(lowerQuery)
      case 'equalsNot':
        return lowerText !== lowerQuery
      case 'containsNot':
        return !lowerText.includes(lowerQuery)
      case 'startsWithNot':
        return !lowerText.startsWith(lowerQuery)
      case 'endsWithNot':
        return !lowerText.endsWith(lowerQuery)
      default:
        return lowerText.includes(lowerQuery)
    }
  }

  const filteredContacts = useMemo(() => {
    const contactsArray = Array.isArray(contacts) ? contacts : []
    let filtered = [...contactsArray]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        item =>
          matchesSearchFilter(item.name || '', searchQuery, searchFilterMode) ||
          matchesSearchFilter(item.phone || '', searchQuery, searchFilterMode)
      )
    }

    // Sort alphabetically by name
    filtered.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase()
      const nameB = (b.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

    return filtered
  }, [contacts, searchQuery, searchFilterMode])

  const handleCopy = async (text: string, cellId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCellId(cellId)
      setTimeout(() => setCopiedCellId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Contact className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a device to view contacts</p>
        </CardContent>
      </Card>
    )
  }

  if (!syncEnabled) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Contact className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Real-time sync is disabled</p>
          <p className="text-sm mt-2">Enable sync toggle to view contacts</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Contact className="h-4 w-4" />
            Contacts ({filteredContacts.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            {loading && contacts.length === 0 && (
              <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 border border-red-500/50 bg-red-500/10 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <X className="h-4 w-4" />
              <span>{error}</span>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && contacts.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border-b border-border">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Contact className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No contacts found</p>
            <p className="text-sm mt-2">Contacts will appear here when synced from device</p>
          </div>
        ) : (
          <>
            {/* Admin Search Controls */}
            <FeatureGate adminOnly={true}>
              <div className="mb-4 p-4 border-b border-border">
                <div className="w-64">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    filterMode={searchFilterMode}
                    onFilterModeChange={setSearchFilterMode}
                  />
                </div>
              </div>
            </FeatureGate>

            {/* Contacts Table */}
            <div className="rounded-lg border overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">S.No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'No contacts match your search' : 'No contacts'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map((contact, index) => {
                      const rowId = `contact-${index}`
                      return (
                        <TableRow
                          key={`${contact.phone}-${index}`}
                          className={
                            index % 2 === 0
                              ? 'bg-slate-200/60 dark:bg-slate-700/60'
                              : 'bg-slate-50/30 dark:bg-slate-900/30'
                          }
                        >
                          <TableCell className="font-mono text-xs group relative">
                            <span>{index + 1}</span>
                            <button
                              onClick={() => handleCopy(String(index + 1), `${rowId}-sno`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-sno` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="group relative">
                            <span>{contact.name || '-'}</span>
                            <button
                              onClick={() => handleCopy(contact.name || '', `${rowId}-name`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-name` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="group relative font-mono text-sm">
                            <span>{contact.phone}</span>
                            <button
                              onClick={() => handleCopy(contact.phone, `${rowId}-phone`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                              title="Copy"
                            >
                              {copiedCellId === `${rowId}-phone` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Bookmark className="h-4 w-4 opacity-60" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
