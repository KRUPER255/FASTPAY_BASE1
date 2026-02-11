import { Card, CardContent } from '@/component/ui/card'
import InputListWithTabs from '@/component/InputListWithTabs'
import type { InputFile } from '../types'

interface InputFilesSectionProps {
  deviceId: string
  files: InputFile[]
  loading: boolean
  previewFile: InputFile | null
  onPreview: (file: InputFile) => void
  onClosePreview: () => void
}

export function InputFilesSection({
  deviceId,
  files,
  loading,
  previewFile,
  onPreview,
  onClosePreview,
}: InputFilesSectionProps) {
  if (!deviceId) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a device to view input files</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <InputListWithTabs
          files={files}
          loading={loading}
          previewFile={previewFile}
          onPreview={onPreview}
          onClosePreview={onClosePreview}
        />
      </CardContent>
    </Card>
  )
}
