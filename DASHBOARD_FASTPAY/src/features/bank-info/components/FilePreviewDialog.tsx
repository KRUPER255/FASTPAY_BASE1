import { Download, Trash2, FileText } from 'lucide-react'
import { Button } from '@/component/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/component/ui/dialog'
import type { UploadedFile } from '@/hooks/bank-info'

interface FilePreviewDialogProps {
  file: UploadedFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (file: UploadedFile) => void
  formatFileSize: (bytes: number) => string
}

/**
 * FilePreviewDialog - Modal for file preview
 */
export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
  onDelete,
  formatFileSize,
}: FilePreviewDialogProps) {
  if (!file) return null

  const handleDelete = () => {
    onDelete(file)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto">
          <div className="space-y-4">
            {file.type === 'image' && (
              <img
                src={file.url}
                alt={file.name}
                className="w-full h-auto rounded-lg"
              />
            )}
            {file.type === 'video' && (
              <video src={file.url} controls className="w-full rounded-lg">
                Your browser does not support the video tag.
              </video>
            )}
            {file.type === 'file' && (
              <div className="p-8 text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium mb-2">{file.name}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {formatFileSize(file.size)}
                </p>
                <Button onClick={() => window.open(file.url, '_blank')}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <p>Type: {file.contentType}</p>
                <p>Size: {formatFileSize(file.size)}</p>
                <p>Uploaded: {new Date(file.uploadedAt).toLocaleString('en-US')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(file.url, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
