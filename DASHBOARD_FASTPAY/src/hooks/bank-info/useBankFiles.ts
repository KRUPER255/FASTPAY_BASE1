import { useState, useEffect } from 'react'
import { storage } from '@/lib/firebase'
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
  deleteObject,
} from 'firebase/storage'
import { useToast } from '@/lib/use-toast'

export interface UploadedFile {
  name: string
  url: string
  type: 'image' | 'video' | 'file'
  contentType: string
  size: number
  uploadedAt: string
  path: string
}

export interface UseBankFilesParams {
  deviceCode: string | null
}

export interface UseBankFilesReturn {
  uploadedFiles: UploadedFile[]
  loadingFiles: boolean
  uploading: boolean
  uploadFile: (file: File, type: 'image' | 'video' | 'file') => Promise<void>
  deleteFile: (file: UploadedFile) => Promise<void>
  formatFileSize: (bytes: number) => string
}

/**
 * Custom hook for managing bank info files
 * Handles file upload, deletion, and listing
 */
export function useBankFiles({ deviceCode }: UseBankFilesParams): UseBankFilesReturn {
  const { toast } = useToast()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Fetch uploaded files
  useEffect(() => {
    if (!deviceCode) {
      setUploadedFiles([])
      return
    }

    let isMounted = true

    const fetchFiles = async () => {
      setLoadingFiles(true)
      try {
        const [imagesRef, videosRef, filesRef] = [
          storageRef(storage, `bank-info/${deviceCode}/images`),
          storageRef(storage, `bank-info/${deviceCode}/videos`),
          storageRef(storage, `bank-info/${deviceCode}/files`),
        ]

        const fetchFilesFromPath = async (ref: any, type: 'image' | 'video' | 'file') => {
          try {
            const res = await listAll(ref)
            return Promise.all(
              res.items.map(async itemRef => {
                const url = await getDownloadURL(itemRef)
                const metadata = await getMetadata(itemRef)
                return {
                  name: itemRef.name,
                  url,
                  type,
                  contentType: metadata.contentType || 'application/octet-stream',
                  size: metadata.size,
                  uploadedAt: metadata.timeCreated,
                  path: itemRef.fullPath,
                }
              })
            )
          } catch (error) {
            console.error(`Error fetching ${type}s:`, error)
            return []
          }
        }

        const [images, videos, files] = await Promise.all([
          fetchFilesFromPath(imagesRef, 'image'),
          fetchFilesFromPath(videosRef, 'video'),
          fetchFilesFromPath(filesRef, 'file'),
        ])

        if (isMounted) {
          const allFiles = [...images, ...videos, ...files]
          allFiles.sort(
            (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          )
          setUploadedFiles(allFiles)
        }
      } catch (error) {
        console.error('Error fetching files:', error)
        if (isMounted) {
          setUploadedFiles([])
        }
      } finally {
        if (isMounted) {
          setLoadingFiles(false)
        }
      }
    }

    fetchFiles()
    return () => {
      isMounted = false
    }
  }, [deviceCode])

  // Handle file upload
  const uploadFile = async (file: File, type: 'image' | 'video' | 'file') => {
    if (!deviceCode) {
      toast({
        title: 'Error',
        description: 'Device code not found',
        variant: 'destructive',
      })
      return
    }

    try {
      setUploading(true)
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = `bank-info/${deviceCode}/${type}s/${fileName}`
      const fileRef = storageRef(storage, filePath)

      await uploadBytes(fileRef, file)
      const url = await getDownloadURL(fileRef)
      const metadata = await getMetadata(fileRef)

      const uploadedFile: UploadedFile = {
        name: file.name,
        url,
        type,
        contentType: metadata.contentType || file.type,
        size: metadata.size,
        uploadedAt: metadata.timeCreated,
        path: filePath,
      }

      setUploadedFiles(prev => [uploadedFile, ...prev])
      toast({
        title: 'File uploaded',
        description: `${type === 'image' ? 'Image' : type === 'video' ? 'Video' : 'File'} "${file.name}" uploaded successfully`,
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Upload failed',
        description: `Failed to upload ${type === 'image' ? 'image' : type === 'video' ? 'video' : 'file'}`,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  // Handle file delete
  const deleteFile = async (file: UploadedFile) => {
    try {
      const fileRef = storageRef(storage, file.path)
      await deleteObject(fileRef)
      setUploadedFiles(prev => prev.filter(f => f.path !== file.path))
      toast({
        title: 'File deleted',
        description: `File "${file.name}" deleted successfully`,
      })
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        title: 'Delete failed',
        description: 'Failed to delete file',
        variant: 'destructive',
      })
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return { uploadedFiles, loadingFiles, uploading, uploadFile, deleteFile, formatFileSize }
}
