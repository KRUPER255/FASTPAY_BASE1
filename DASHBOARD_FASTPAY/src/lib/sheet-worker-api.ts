/**
 * Sheet worker API client.
 * List available processes; run a process (file or sheet link); caller handles response (blob or JSON).
 */

import { getApiUrl } from './api-client'

export interface SheetWorkerProcess {
  id: string
  label: string
  input_type: 'file' | 'sheet_link'
  description?: string
  accept?: string
}

/**
 * GET /api/sheet-worker/processes/
 * Returns list of available processes.
 */
export async function getSheetWorkerProcesses(): Promise<SheetWorkerProcess[]> {
  const url = getApiUrl('/sheet-worker/processes/')
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(response.status === 401 ? 'Please log in.' : `Failed to load processes: ${text}`)
  }
  return response.json()
}

export interface RunSheetWorkerParams {
  process_id: string
  user_email?: string
  /** For input_type file */
  file?: File
  /** For input_type sheet_link */
  sheet_link?: string
  spreadsheet_id?: string
  range?: string
}

/**
 * POST /api/sheet-worker/run/
 * Sends process_id + either multipart (file) or JSON (sheet_link/spreadsheet_id, range, user_email).
 * Returns raw Response so caller can: response.blob() for Excel, or response.json() for JSON error/download_url.
 */
export async function runSheetWorkerProcess(params: RunSheetWorkerParams): Promise<Response> {
  const url = getApiUrl('/sheet-worker/run/')
  const { process_id, user_email, file, sheet_link, spreadsheet_id, range } = params

  if (file) {
    const formData = new FormData()
    formData.append('process_id', process_id)
    if (user_email) formData.append('user_email', user_email)
    formData.append('file', file)
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
  }

  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      process_id,
      user_email: user_email ?? undefined,
      sheet_link: sheet_link ?? undefined,
      spreadsheet_id: spreadsheet_id ?? undefined,
      range: range ?? undefined,
    }),
  })
}
