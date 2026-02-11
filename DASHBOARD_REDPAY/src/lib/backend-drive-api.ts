/**
 * Backend Google Drive API Service
 * 
 * This module provides functions to interact with Google Drive through the backend API.
 * All authentication is handled server-side using stored OAuth tokens.
 */

import { getApiUrl } from './api-client'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  webViewLink?: string
  webContentLink?: string
  parents?: string[]
  shared?: boolean
}

export interface DriveFileList {
  files: DriveFile[]
  nextPageToken?: string
}

export interface DriveStorageInfo {
  storageQuota: {
    limit: string
    usage: string
    usageInDrive?: string
    usageInDriveTrash?: string
  }
}

/**
 * List files in Google Drive
 */
export async function listDriveFiles(
  userEmail: string,
  options?: {
    page_size?: number
    page_token?: string
    query?: string
    order_by?: string
  }
): Promise<DriveFileList> {
  const params = new URLSearchParams({
    user_email: userEmail,
  })

  if (options?.page_size) {
    params.set('page_size', String(options.page_size))
  }
  if (options?.page_token) {
    params.set('page_token', options.page_token)
  }
  if (options?.query) {
    params.set('query', options.query)
  }
  if (options?.order_by) {
    params.set('order_by', options.order_by)
  }

  const response = await fetch(getApiUrl(`/drive/files/?${params.toString()}`))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to list files: ${error}`)
  }

  return response.json()
}

/**
 * Get file metadata
 */
export async function getDriveFileMetadata(userEmail: string, fileId: string): Promise<DriveFile> {
  const response = await fetch(
    getApiUrl(`/drive/files/${fileId}/?user_email=${encodeURIComponent(userEmail)}`)
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to get file metadata: ${error}`)
  }

  return response.json()
}

/**
 * Download file content
 */
export async function downloadDriveFile(userEmail: string, fileId: string): Promise<Blob> {
  const response = await fetch(
    getApiUrl(`/drive/files/${fileId}/download/?user_email=${encodeURIComponent(userEmail)}`)
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to download file: ${error}`)
  }

  return response.blob()
}

/**
 * Upload file to Google Drive
 */
export async function uploadDriveFile(
  userEmail: string,
  file: File,
  options?: {
    parent_folder_id?: string
    description?: string
  }
): Promise<DriveFile> {
  const formData = new FormData()
  formData.append('user_email', userEmail)
  formData.append('file', file)
  if (options?.parent_folder_id) {
    formData.append('parent_folder_id', options.parent_folder_id)
  }
  if (options?.description) {
    formData.append('description', options.description)
  }

  const response = await fetch(getApiUrl('/drive/upload/'), {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to upload file: ${error}`)
  }

  return response.json()
}

/**
 * Create folder in Google Drive
 */
export async function createDriveFolder(
  userEmail: string,
  folderName: string,
  options?: {
    parent_folder_id?: string
  }
): Promise<DriveFile> {
  const response = await fetch(getApiUrl('/drive/folders/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      folder_name: folderName,
      parent_folder_id: options?.parent_folder_id,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to create folder: ${error}`)
  }

  return response.json()
}

/**
 * Delete file from Google Drive
 */
export async function deleteDriveFile(userEmail: string, fileId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(getApiUrl(`/drive/files/${fileId}/delete/`), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to delete file: ${error}`)
  }

  return response.json()
}

/**
 * Share file in Google Drive
 */
export async function shareDriveFile(
  userEmail: string,
  fileId: string,
  email: string,
  role: 'reader' | 'writer' | 'commenter' = 'reader'
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(getApiUrl(`/drive/files/${fileId}/share/`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      email: email,
      role: role,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to share file: ${error}`)
  }

  return response.json()
}

/**
 * Copy file in Google Drive
 */
export async function copyDriveFile(
  userEmail: string,
  fileId: string,
  newName?: string,
  parentFolderId?: string
): Promise<DriveFile> {
  const response = await fetch(getApiUrl(`/drive/files/${fileId}/copy/`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_email: userEmail,
      new_name: newName,
      parent_folder_id: parentFolderId,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to copy file: ${error}`)
  }

  return response.json()
}

/**
 * Search files in Google Drive
 */
export async function searchDriveFiles(
  userEmail: string,
  query: string,
  options?: {
    page_size?: number
    page_token?: string
  }
): Promise<DriveFileList> {
  const params = new URLSearchParams({
    user_email: userEmail,
    query: query,
  })

  if (options?.page_size) {
    params.set('page_size', String(options.page_size))
  }
  if (options?.page_token) {
    params.set('page_token', options.page_token)
  }

  const response = await fetch(getApiUrl(`/drive/search/?${params.toString()}`))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to search files: ${error}`)
  }

  return response.json()
}

/**
 * Get storage information
 */
export async function getDriveStorageInfo(userEmail: string): Promise<DriveStorageInfo> {
  const response = await fetch(getApiUrl(`/drive/storage/?user_email=${encodeURIComponent(userEmail)}`))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authentication expired. Please reconnect.')
    }
    const error = await response.text()
    throw new Error(`Failed to get storage info: ${error}`)
  }

  return response.json()
}
