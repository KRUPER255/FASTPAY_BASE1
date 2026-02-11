import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/component/ui/tabs'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { Skeleton } from '@/component/ui/skeleton'
import {
  TextCursorInput,
  Image as ImageIcon,
  Video,
  FileText,
  PictureInPicture2,
  CornerRightDown,
  Loader,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/component/ui/dialog'

interface InputFile {
  name: string
  url: string
  contentType: string
  size: number
  time: string
}

interface InputListWithTabsProps {
  files: InputFile[]
  loading?: boolean
  onPreview?: (file: InputFile) => void
  previewFile?: InputFile | null
  onClosePreview?: () => void
}

export default function InputListWithTabs({
  files,
  loading = false,
  onPreview,
  previewFile,
  onClosePreview,
}: InputListWithTabsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'documents'>('all')

  // Filter files by type
  const filteredFiles = useMemo(() => {
    if (activeTab === 'images') {
      return files.filter(f => f.contentType.startsWith('image/'))
    } else if (activeTab === 'videos') {
      return files.filter(f => f.contentType.startsWith('video/'))
    } else if (activeTab === 'documents') {
      return files.filter(
        f => !f.contentType.startsWith('image/') && !f.contentType.startsWith('video/')
      )
    }
    return files
  }, [files, activeTab])

  // Calculate counts
  const imageCount = files.filter(f => f.contentType.startsWith('image/')).length
  const videoCount = files.filter(f => f.contentType.startsWith('video/')).length
  const documentCount = files.filter(
    f => !f.contentType.startsWith('image/') && !f.contentType.startsWith('video/')
  ).length
  const totalCount = files.length

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground py-12">
        <TextCursorInput className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No files found</p>
        <p className="text-sm mt-2">Files uploaded from the device will appear here</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TextCursorInput className="h-6 w-6" />
            Input Files
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Files uploaded from device</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as 'all' | 'images' | 'videos' | 'documents')}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All
            <Badge variant="secondary" className="ml-1">
              {totalCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Images
            <Badge variant="secondary" className="ml-1 bg-blue-500/20 text-blue-600">
              {imageCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Videos
            <Badge variant="secondary" className="ml-1 bg-purple-500/20 text-purple-600">
              {videoCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
            <Badge variant="secondary" className="ml-1 bg-gray-500/20 text-gray-600">
              {documentCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <FileGrid files={filteredFiles} onPreview={onPreview} />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <FileGrid files={filteredFiles} onPreview={onPreview} />
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <FileGrid files={filteredFiles} onPreview={onPreview} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <FileGrid files={filteredFiles} onPreview={onPreview} />
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={open => !open && onClosePreview?.()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            {previewFile.contentType.startsWith('image/') ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="w-full h-auto rounded-lg"
              />
            ) : previewFile.contentType.startsWith('video/') ? (
              <video src={previewFile.url} controls className="w-full h-auto rounded-lg" />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function FileGrid({
  files,
  onPreview,
}: {
  files: InputFile[]
  onPreview?: (file: InputFile) => void
}) {
  if (files.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p className="text-sm">No files in this category</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {files.map(file => {
        const isImage = file.contentType.startsWith('image/')
        const isVideo = file.contentType.startsWith('video/')

        return (
          <div
            key={file.name}
            className="group relative border border-border rounded-lg overflow-hidden bg-background hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
              {isImage ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                  onClick={() => onPreview?.(file)}
                />
              ) : isVideo ? (
                <video src={file.url} className="w-full h-full object-cover" />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
              )}

              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {(isImage || isVideo) && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-black"
                    onClick={() => onPreview?.(file)}
                    title="Preview"
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                  </Button>
                )}
                <a
                  href={file.url}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/90 hover:bg-white text-black transition-colors"
                  title="Download"
                >
                  <CornerRightDown className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium truncate" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>{(file.size / 1024).toFixed(1)} KB</span>
                <span>{new Date(file.time).toLocaleDateString('en-US')}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
