import { useRef } from 'react'
import { Image as ImageIcon, Video, File, Eye, Download, Trash2, FileText } from 'lucide-react'
import { Button } from '@/component/ui/button'
import { Label } from '@/component/ui/label'
import { Card, CardContent } from '@/component/ui/card'
import type { UploadedFile } from '@/hooks/bank-info'

interface FileUploadSectionProps {
  deviceCode: string | null
  uploadedFiles: UploadedFile[]
  uploading: boolean
  onFileUpload: (file: File, type: 'image' | 'video' | 'file') => Promise<void>
  onFileDelete: (file: UploadedFile) => Promise<void>
  onFilePreview: (file: UploadedFile) => void
  formatFileSize: (bytes: number) => string
}

/**
 * FileUploadSection - File upload and management UI
 */
export function FileUploadSection({
  deviceCode,
  uploadedFiles,
  uploading,
  onFileUpload,
  onFileDelete,
  onFilePreview,
  formatFileSize,
}: FileUploadSectionProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="font-semibold text-lg">Upload Files</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Upload Image</Label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                onFileUpload(file, 'image')
                if (imageInputRef.current) imageInputRef.current.value = ''
              }
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading || !deviceCode}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Choose Image'}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Upload Video</Label>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                onFileUpload(file, 'video')
                if (videoInputRef.current) videoInputRef.current.value = ''
              }
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading || !deviceCode}
          >
            <Video className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Choose Video'}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Upload File</Label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                onFileUpload(file, 'file')
                if (fileInputRef.current) fileInputRef.current.value = ''
              }
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !deviceCode}
          >
            <File className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Choose File'}
          </Button>
        </div>
      </div>

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold text-lg">Uploaded Files</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {uploadedFiles.map((file, index) => (
              <Card key={index} className="relative group">
                <CardContent className="p-3">
                  {file.type === 'image' ? (
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => onFilePreview(file)}
                      />
                    </div>
                  ) : file.type === 'video' ? (
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                      <Video className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs font-medium truncate mb-1">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 flex-1"
                      onClick={() => onFilePreview(file)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-destructive"
                      onClick={() => onFileDelete(file)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
