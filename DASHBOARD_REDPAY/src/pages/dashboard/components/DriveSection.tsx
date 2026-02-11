import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card'
import { Button } from '@/component/ui/button'
import { Input } from '@/component/ui/input'
import { Badge } from '@/component/ui/badge'
import { Skeleton } from '@/component/ui/skeleton'
import { useToast } from '@/lib/use-toast'
import { ToastAction } from '@/component/ui/toast'
import {
  Folder,
  File,
  Loader,
  RefreshCw,
  Search,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  Share2,
  Copy,
  FolderPlus,
  HardDrive,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import {
  initGmailAuth,
  checkGmailStatus,
  type GmailStatus,
} from '@/lib/backend-gmail-api'
import {
  listDriveFiles,
  getDriveFileMetadata,
  downloadDriveFile,
  uploadDriveFile,
  createDriveFolder,
  deleteDriveFile,
  shareDriveFile,
  copyDriveFile,
  searchDriveFiles,
  getDriveStorageInfo,
  type DriveFile,
  type DriveFileList,
  type DriveStorageInfo,
} from '@/lib/backend-drive-api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/component/ui/dialog'
import { Label } from '@/component/ui/label'

interface DriveSectionProps {
  deviceId: string | null
  isAdmin: boolean
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('folder')) return Folder
  if (mimeType.includes('image')) return ImageIcon
  if (mimeType.includes('video')) return Video
  if (mimeType.includes('audio')) return Music
  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('zip') || mimeType.includes('rar')) return Archive
  return File
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return 'N/A'
  const size = parseInt(bytes)
  if (isNaN(size)) return bytes
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-US')
  } catch {
    return dateString
  }
}

export function DriveSection({ deviceId, isAdmin }: DriveSectionProps) {
  const { toast } = useToast()
  const session = getSession()
  const userEmail = session?.email || null

  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(25)
  const [pageToken, setPageToken] = useState<string | undefined>()
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [previousPageTokens, setPreviousPageTokens] = useState<string[]>([])
  const [storageInfo, setStorageInfo] = useState<DriveStorageInfo | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [folderName, setFolderName] = useState('')
  const [parentFolderId, setParentFolderId] = useState<string | undefined>()

  const isAuthenticated = gmailStatus?.connected ?? false

  // Check authentication status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (!userEmail) {
        setCheckingAuth(false)
        return
      }

      setCheckingAuth(true)
      try {
        const status = await checkGmailStatus(userEmail)
        setGmailStatus(status)
      } catch (error) {
        console.error('Failed to check Google status:', error)
        setGmailStatus({ connected: false, gmail_email: null })
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuthStatus()

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')

    if (code && state && userEmail) {
      setTimeout(() => {
        checkAuthStatus()
      }, 2000)
    }
  }, [userEmail])

  // Load storage info when authenticated
  useEffect(() => {
    const loadStorageInfo = async () => {
      if (!isAuthenticated || !userEmail) return

      try {
        const info = await getDriveStorageInfo(userEmail)
        setStorageInfo(info)
      } catch (error) {
        console.error('Failed to load storage info:', error)
      }
    }

    if (isAuthenticated) {
      loadStorageInfo()
    }
  }, [isAuthenticated, userEmail])

  // Fetch files when authenticated
  const loadFiles = useCallback(
    async (query?: string, page?: string) => {
      if (!isAuthenticated || !userEmail) return

      setLoading(true)
      try {
        let response: DriveFileList

        if (query) {
          // Use search API
          response = await searchDriveFiles(userEmail, query, {
            page_size: pageSize,
            page_token: page,
          })
        } else {
          // Use list API
          response = await listDriveFiles(userEmail, {
            page_size: pageSize,
            page_token: page,
            query: query,
          })
        }

        setFiles(response.files || [])
        setNextPageToken(response.nextPageToken)

        if (page) {
          setPageToken(page)
        }
      } catch (error) {
        console.error('Failed to load files:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load files'
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })

        if (errorMessage.includes('authentication expired')) {
          const status = await checkGmailStatus(userEmail)
          setGmailStatus(status)
        }
      } finally {
        setLoading(false)
      }
    },
    [isAuthenticated, userEmail, pageSize, toast]
  )

  useEffect(() => {
    if (isAuthenticated) {
      loadFiles()
    }
  }, [isAuthenticated, pageSize])

  const handleAuth = async () => {
    if (!userEmail) {
      toast({
        title: 'Error',
        description: 'Please log in to connect Google Drive',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const isRedpay = import.meta.env.VITE_REDPAY_ONLY === 'true'
      const options = isRedpay
        ? { dashboard_origin: window.location.origin, dashboard_path: 'dashboard' }
        : undefined
      const { auth_url } = await initGmailAuth(userEmail, 'webpage', options)
      window.location.href = auth_url
    } catch (error) {
      console.error('Google authentication failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start Google authentication'
      toast({
        title: 'Authentication Failed',
        description: errorMessage,
        variant: 'destructive',
        action: (
          <ToastAction
            altText="Copy error"
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              try {
                // Try modern clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(errorMessage)
                } else {
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea')
                  textArea.value = errorMessage
                  textArea.style.position = 'fixed'
                  textArea.style.left = '-999999px'
                  textArea.style.top = '-999999px'
                  document.body.appendChild(textArea)
                  textArea.focus()
                  textArea.select()
                  document.execCommand('copy')
                  textArea.remove()
                }
                toast({
                  title: 'Copied',
                  description: 'Error message copied to clipboard',
                })
              } catch (err) {
                console.error('Failed to copy:', err)
                toast({
                  title: 'Copy Failed',
                  description: 'Could not copy to clipboard. Please copy manually.',
                  variant: 'destructive',
                })
              }
            }}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </ToastAction>
        ),
      })
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!userEmail) return

    setLoading(true)
    try {
      // Use Gmail disconnect (same account for both services)
      const { disconnectGmail } = await import('@/lib/backend-gmail-api')
      await disconnectGmail(userEmail)
      setGmailStatus({ connected: false, gmail_email: null })
      setFiles([])
      setSelectedFile(null)
      setStorageInfo(null)
      toast({
        title: 'Logged Out',
        description: 'Disconnected from Google Drive',
      })
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPreviousPageTokens([])
    setPageToken(undefined)
    loadFiles(searchQuery)
  }

  const handleNextPage = () => {
    if (nextPageToken) {
      setPreviousPageTokens((prev) => [...prev, pageToken || ''])
      loadFiles(searchQuery, nextPageToken)
    }
  }

  const handlePreviousPage = () => {
    if (previousPageTokens.length > 0) {
      const tokens = [...previousPageTokens]
      const prevToken = tokens.pop()
      setPreviousPageTokens(tokens)
      setPageToken(prevToken)
      loadFiles(searchQuery, prevToken)
    }
  }

  const handleFileClick = async (file: DriveFile) => {
    if (file.mimeType.includes('folder')) {
      // Navigate into folder (could implement folder navigation)
      toast({
        title: 'Folder Navigation',
        description: 'Folder navigation coming soon',
      })
      return
    }

    setLoadingFile(true)
    try {
      const metadata = await getDriveFileMetadata(userEmail!, file.id)
      setSelectedFile(metadata)
    } catch (error) {
      console.error('Failed to load file:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load file',
        variant: 'destructive',
      })
    } finally {
      setLoadingFile(false)
    }
  }

  const handleDownload = async (file: DriveFile) => {
    if (!userEmail) return

    setLoading(true)
    try {
      const blob = await downloadDriveFile(userEmail, file.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({
        title: 'Success',
        description: 'File downloaded',
      })
    } catch (error) {
      console.error('Failed to download file:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download file',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (file: DriveFile) => {
    if (!userEmail) return

    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return
    }

    setLoading(true)
    try {
      await deleteDriveFile(userEmail, file.id)
      toast({
        title: 'Success',
        description: 'File deleted',
      })
      loadFiles(searchQuery, pageToken)
    } catch (error) {
      console.error('Failed to delete file:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete file',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async (file: DriveFile) => {
    if (!userEmail) return

    const email = prompt('Enter email address to share with:')
    if (!email) return

    setLoading(true)
    try {
      await shareDriveFile(userEmail, file.id, email, 'reader')
      toast({
        title: 'Success',
        description: `File shared with ${email}`,
      })
    } catch (error) {
      console.error('Failed to share file:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to share file',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!userEmail || !uploadFile) return

    setLoading(true)
    try {
      await uploadDriveFile(userEmail, uploadFile, {
        parent_folder_id: parentFolderId,
      })
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      })
      setShowUploadDialog(false)
      setUploadFile(null)
      loadFiles(searchQuery, pageToken)
    } catch (error) {
      console.error('Failed to upload file:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!userEmail || !folderName.trim()) return

    setLoading(true)
    try {
      await createDriveFolder(userEmail, folderName.trim(), {
        parent_folder_id: parentFolderId,
      })
      toast({
        title: 'Success',
        description: 'Folder created successfully',
      })
      setShowFolderDialog(false)
      setFolderName('')
      loadFiles(searchQuery, pageToken)
    } catch (error) {
      console.error('Failed to create folder:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create folder',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking auth status
  if (checkingAuth) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader className="h-6 w-6 animate-spin mr-2" />
              <span>Checking Google Drive connection...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error if no user email
  if (!userEmail) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Google Drive Integration
            </CardTitle>
            <CardDescription>Please log in to connect your Google Drive account</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Show connect screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Google Drive Integration
            </CardTitle>
            <CardDescription>One sign-in connects both Gmail and Google Drive</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Folder className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Connect Gmail & Drive</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in with Google once to access both Gmail and Google Drive. You’ll grant access to both in a single step.
                </p>
                {gmailStatus?.gmail_email && (
                  <p className="text-xs text-muted-foreground mb-2">Account: {gmailStatus.gmail_email}</p>
                )}
              </div>
              <Button onClick={handleAuth} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Connect Gmail & Drive
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate storage usage
  const storageUsage = storageInfo?.storageQuota
    ? (parseInt(storageInfo.storageQuota.usage) / parseInt(storageInfo.storageQuota.limit)) * 100
    : 0

  return (
    <div className="space-y-4">
      {/* Storage Info Card */}
      {storageInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-medium">
                  {formatFileSize(storageInfo.storageQuota.usage)} /{' '}
                  {formatFileSize(storageInfo.storageQuota.limit)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(storageUsage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {storageUsage.toFixed(1)}% used
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Files Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Google Drive Files
              </CardTitle>
              <CardDescription>
                {gmailStatus?.gmail_email && (
                  <span className="mr-2">Connected: {gmailStatus.gmail_email}</span>
                )}
                {files.length} {files.length === 1 ? 'file' : 'files'} loaded
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowUploadDialog(true)} disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <Button variant="outline" onClick={() => setShowFolderDialog(true)} disabled={loading}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
              <Button variant="outline" onClick={() => loadFiles()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files (e.g., name contains 'test')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 files</SelectItem>
                <SelectItem value="25">25 files</SelectItem>
                <SelectItem value="50">50 files</SelectItem>
                <SelectItem value="100">100 files</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Files List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No files found</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
                {files.map((file) => {
                  const FileIcon = getFileIcon(file.mimeType)
                  return (
                    <div
                      key={file.id}
                      className="p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                          onClick={() => handleFileClick(file)}
                        >
                          <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{file.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{formatFileSize(file.size)}</span>
                              <span>•</span>
                              <span>{formatDate(file.modifiedTime)}</span>
                              {file.shared && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    Shared
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!file.mimeType.includes('folder') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(file)}
                                disabled={loading}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleShare(file)}
                                disabled={loading}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(file)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={handlePreviousPage}
                  disabled={previousPageTokens.length === 0 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {previousPageTokens.length + 1}
                </span>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={!nextPageToken || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* File Detail View */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                File Details
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingFile ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{selectedFile.name}</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Type: {selectedFile.mimeType}</div>
                    <div>Size: {formatFileSize(selectedFile.size)}</div>
                    <div>Modified: {formatDate(selectedFile.modifiedTime)}</div>
                    {selectedFile.webViewLink && (
                      <div>
                        <a
                          href={selectedFile.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Open in Google Drive
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!selectedFile.mimeType.includes('folder') && (
                    <>
                      <Button variant="outline" onClick={() => handleDownload(selectedFile)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button variant="outline" onClick={() => handleShare(selectedFile)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => handleDelete(selectedFile)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!uploadFile || loading}>
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder} disabled={!folderName.trim() || loading}>
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
