/**
 * Message Processing Scripts
 *
 * This file contains different message processing scripts that can be applied to messages.
 * Each script is a function that takes an array of messages and returns processed messages.
 */

export interface Message {
  timestamp: number
  type: 'sent' | 'received'
  phone: string
  body: string
}

/**
 * Base interface for message processing scripts
 */
export interface MessageProcessor {
  id: string
  name: string
  description: string
  process: (messages: Message[], options?: Record<string, any>) => Message[]
  requiresInput?: boolean // Whether this processor needs user input
  inputLabel?: string // Label for the input field
  inputPlaceholder?: string // Placeholder for the input field
}

/**
 * Helper function to extract amount from NEFT or INR message
 */
const extractAmount = (message: string): number | null => {
  // Try NEFT format first: "NEFT of Rs. 1,000.00"
  const neftMatch = message.match(/NEFT of Rs\.\s*([\d,]+(?:\.\d{2})?)/i)
  if (neftMatch && neftMatch[1]) {
    // Remove commas and parse amount
    let amountStr = neftMatch[1].replace(/,/g, '')
    // Remove last 3 characters if they are ".00" (dot and two zeros)
    if (amountStr.endsWith('.00')) {
      amountStr = amountStr.slice(0, -3)
    }
    const amount = parseFloat(amountStr)
    return isNaN(amount) ? null : Math.floor(amount) // Return integer part only
  }

  // Try INR format: "INR 1,000.00" or "INR 1000"
  const inrMatch = message.match(/INR\s+([\d,]+(?:\.\d{2})?)/i)
  if (inrMatch && inrMatch[1]) {
    // Remove commas and parse amount
    let amountStr = inrMatch[1].replace(/,/g, '')
    // Remove last 3 characters if they are ".00" (dot and two zeros)
    if (amountStr.endsWith('.00')) {
      amountStr = amountStr.slice(0, -3)
    }
    const amount = parseFloat(amountStr)
    return isNaN(amount) ? null : Math.floor(amount) // Return integer part only
  }

  return null
}

/**
 * Helper function to extract amount from IOB messages
 * Supports various IOB formats:
 * - "credited by Rs. 1,500.00" (credit format)
 * - "debited by Rs. 1,000.00" (debit format)
 * - "Rs. 1,000.00" or "INR 1,000.00" (general format)
 * - "1,000.00" (standalone amount)
 */
const extractIOBAmount = (message: string): number | null => {
  if (!message) return null

  // Try IOB credit/debit format: "credited by Rs. 1,500.00" or "debited by Rs. 1,000.00"
  const creditDebitMatch = message.match(/(?:credited|debited)\s+by\s+Rs\.\s*([\d,]+(?:\.\d{2})?)/i)
  if (creditDebitMatch && creditDebitMatch[1]) {
    let amountStr = creditDebitMatch[1].replace(/,/g, '')
    if (amountStr.endsWith('.00')) {
      amountStr = amountStr.slice(0, -3)
    }
    const amount = parseFloat(amountStr)
    return isNaN(amount) ? null : Math.floor(amount)
  }

  // Try "Rs." or "INR" format: "Rs. 1,000.00" or "INR 1,000.00"
  const rsMatch = message.match(/(?:Rs\.?|INR)\s+([\d,]+(?:\.\d{2})?)/i)
  if (rsMatch && rsMatch[1]) {
    let amountStr = rsMatch[1].replace(/,/g, '')
    if (amountStr.endsWith('.00')) {
      amountStr = amountStr.slice(0, -3)
    }
    const amount = parseFloat(amountStr)
    return isNaN(amount) ? null : Math.floor(amount)
  }

  // Try standalone amount format: "1,000.00 debited" or "1,000.00 credited"
  const standaloneMatch = message.match(/^([\d,]+(?:\.\d{2})?)/)
  if (standaloneMatch && standaloneMatch[1]) {
    let amountStr = standaloneMatch[1].replace(/,/g, '')
    if (amountStr.endsWith('.00')) {
      amountStr = amountStr.slice(0, -3)
    }
    const amount = parseFloat(amountStr)
    return isNaN(amount) ? null : Math.floor(amount)
  }

  return null
}

/**
 * Helper function to check if message matches IOB credit pattern
 * Pattern: "Your a/c no. XXXXX{lastDigits} is credited by Rs.{amount}"
 */
const matchesIOBCreditPattern = (message: string, lastDigits: string): boolean => {
  if (!message || !lastDigits) return false
  // Check if message matches: "Your a/c no. XXXXX{lastDigits} is credited by Rs."
  const pattern = new RegExp(
    `Your\\s+a/c\\s+no\\.\\s+X+${lastDigits}\\s+is\\s+credited\\s+by\\s+Rs\\.`,
    'i'
  )
  return pattern.test(message)
}

/**
 * Helper function to get transaction type from IOB message
 * Returns 'debit', 'credit', or null
 * Checks for "credited by" or "debited by" patterns
 */
const getIOBTransactionType = (message: string): 'debit' | 'credit' | null => {
  if (!message) return null
  const lowerMessage = message.toLowerCase()
  // Check for "credited by" or "debited by" (IOB format)
  if (lowerMessage.includes('debited by') || lowerMessage.includes('debited')) return 'debit'
  if (lowerMessage.includes('credited by') || lowerMessage.includes('credited')) return 'credit'
  return null
}

/**
 * Helper function to get prefix type from message
 */
const getPrefixType = (message: string): 'NEFT' | 'INR' | null => {
  if (!message) return null
  const trimmed = message.trim()
  if (trimmed.startsWith('NEFT of Rs.')) return 'NEFT'
  if (trimmed.startsWith('INR ')) return 'INR'
  return null
}

/**
 * Helper function to get 3rd word from INR message
 * Example: "INR 200001.00 credited to RBL Bank..." -> "credited"
 */
const getINRThirdWord = (message: string): string | null => {
  if (!message) return null
  const trimmed = message.trim()
  if (!trimmed.startsWith('INR ')) return null

  // Split by spaces and get 3rd word (index 2)
  const words = trimmed.split(/\s+/)
  if (words.length >= 3) {
    // Skip "INR" and amount, get the 3rd word (action word like "credited", "debited")
    // Format: "INR" "200001.00" "credited" ...
    return words[2].toLowerCase()
  }
  return null
}

/**
 * NEFT/INR Merge Processor
 * Merges consecutive messages with same prefix (NEFT or INR)
 * For INR messages, also checks if 3rd word matches
 */
export const neftInrMergeProcessor: MessageProcessor = {
  id: 'neft-inr-merge',
  name: 'RBL',
  description:
    'Merges consecutive NEFT or INR messages with same prefix and same 3rd word (for INR)',
  process: (messages: Message[], options?: Record<string, any>): Message[] => {
    if (!messages || messages.length === 0) return messages

    // Create a working copy to avoid mutating the original
    const workingMessages = messages.map(msg => ({ ...msg }))
    const skipIndices = new Set<number>()
    const mergeCounts = new Map<number, number>() // Track merge count for each message index

    // Process messages from newest to oldest
    for (let i = 0; i < workingMessages.length - 1; i++) {
      // Skip if already processed
      if (skipIndices.has(i)) continue

      const currentMsg = workingMessages[i]
      const nextMsg = workingMessages[i + 1] // Older message

      // Get prefix types for both messages
      const currentPrefix = currentMsg.body ? getPrefixType(currentMsg.body) : null
      const nextPrefix = nextMsg.body ? getPrefixType(nextMsg.body) : null

      // Only merge if both messages have the SAME prefix (both NEFT or both INR)
      if (currentPrefix && nextPrefix && currentPrefix === nextPrefix) {
        // For INR messages, also check if 3rd word is the same
        if (currentPrefix === 'INR') {
          const currentThirdWord = getINRThirdWord(currentMsg.body)
          const nextThirdWord = getINRThirdWord(nextMsg.body)

          // If 3rd words don't match, don't merge
          if (currentThirdWord !== nextThirdWord) {
            continue
          }
        }

        // Extract amounts from both messages
        const currentAmount = extractAmount(currentMsg.body)
        const nextAmount = extractAmount(nextMsg.body)

        if (currentAmount !== null && nextAmount !== null) {
          // Calculate total amount (add current/newer to next/older)
          // Amounts are already integers (decimal part removed)
          const totalAmount = nextAmount + currentAmount
          // Format amount with commas (as integer, no decimal)
          const formattedAmount = totalAmount.toLocaleString('en-IN')

          // Get merge count for the target message (nextMsg at i+1)
          let targetMergeCount = mergeCounts.get(i + 1)
          if (targetMergeCount === undefined) {
            const targetMergeMatch = nextMsg.body.match(/\[Merged:\s*(\d+)\s*messages?\]/i)
            if (targetMergeMatch && targetMergeMatch[1]) {
              targetMergeCount = parseInt(targetMergeMatch[1], 10)
            } else {
              targetMergeCount = 1 // Original message counts as 1
            }
          }

          // Get merge count for the current message being merged (currentMsg at i)
          // This message might already represent multiple merged messages
          let currentMergeCount = mergeCounts.get(i)
          if (currentMergeCount === undefined) {
            const currentMergeMatch = currentMsg.body.match(/\[Merged:\s*(\d+)\s*messages?\]/i)
            if (currentMergeMatch && currentMergeMatch[1]) {
              currentMergeCount = parseInt(currentMergeMatch[1], 10)
            } else {
              currentMergeCount = 1 // Original message counts as 1
            }
          }

          // Total merge count = target count + current count
          // Both already represent their respective message counts
          const newMergeCount = targetMergeCount + currentMergeCount
          mergeCounts.set(i + 1, newMergeCount)

          // Update the older message (nextMsg) with merged amount and latest timestamp
          if (nextPrefix === 'NEFT') {
            // Update NEFT message
            workingMessages[i + 1].body = nextMsg.body.replace(
              /NEFT of Rs\.\s*[\d,]+(?:\.\d{2})?/i,
              `NEFT of Rs. ${formattedAmount}`
            )
          } else if (nextPrefix === 'INR') {
            // Update INR message
            workingMessages[i + 1].body = nextMsg.body.replace(
              /INR\s+[\d,]+(?:\.\d{2})?/i,
              `INR ${formattedAmount}`
            )
          }

          // Update timestamp to the latest (newer) message's timestamp
          workingMessages[i + 1].timestamp = currentMsg.timestamp

          // Update phone number to the latest (newer) message's phone
          workingMessages[i + 1].phone = currentMsg.phone

          // Add merge count indicator to the message body
          // Remove existing merge count if present
          workingMessages[i + 1].body = workingMessages[i + 1].body.replace(
            /\s*\[Merged:\s*\d+\s*messages?\]/i,
            ''
          )
          // Add new merge count
          workingMessages[i + 1].body +=
            ` [Merged: ${newMergeCount} message${newMergeCount > 1 ? 's' : ''}]`

          // Mark current (newer) message to skip - don't display it
          skipIndices.add(i)
        }
      }
    }

    // Return only messages that weren't skipped
    return workingMessages.filter((_, index) => !skipIndices.has(index))
  },
}

/**
 * IOB Merge Processor
 * Merges consecutive IOB credit messages matching "Your a/c no. XXXXX{lastDigits} is credited by Rs.{amount}"
 */
export const iobMergeProcessor: MessageProcessor = {
  id: 'iob-merge',
  name: 'IOB',
  description:
    'Merges consecutive IOB credit messages matching "Your a/c no. XXXXX{lastDigits} is credited by Rs.{amount}"',
  requiresInput: true,
  inputLabel: 'Account Last 2 Digits',
  inputPlaceholder: 'e.g., 68',
  process: (messages: Message[], options?: Record<string, any>): Message[] => {
    if (!messages || messages.length === 0) return messages

    // Get account last 2 digits from options
    const accountLastDigits = options?.accountLastDigits || options?.input || ''

    // If no account digits provided, return empty array (no processing)
    if (!accountLastDigits || accountLastDigits.length !== 2 || !/^\d{2}$/.test(accountLastDigits)) {
      return []
    }

    // Create a working copy to avoid mutating the original
    const workingMessages = messages.map(msg => ({ ...msg }))
    const skipIndices = new Set<number>()
    const mergeCounts = new Map<number, number>() // Track merge count for each message index

    // Process messages from newest to oldest
    for (let i = 0; i < workingMessages.length - 1; i++) {
      // Skip if already processed
      if (skipIndices.has(i)) continue

      const currentMsg = workingMessages[i]
      const nextMsg = workingMessages[i + 1] // Older message

      // Check if both messages match the IOB credit pattern with the specified account number
      const currentMatches = currentMsg.body
        ? matchesIOBCreditPattern(currentMsg.body, accountLastDigits)
        : false
      const nextMatches = nextMsg.body
        ? matchesIOBCreditPattern(nextMsg.body, accountLastDigits)
        : false

      // Only merge if both match the pattern
      if (currentMatches && nextMatches) {
        // Extract amounts from both messages
        const currentAmount = currentMsg.body ? extractIOBAmount(currentMsg.body) : null
        const nextAmount = nextMsg.body ? extractIOBAmount(nextMsg.body) : null

        if (currentAmount !== null && nextAmount !== null) {
          // Calculate total amount (add current/newer to next/older)
          const totalAmount = nextAmount + currentAmount
          // Format amount with commas (as integer, no decimal)
          const formattedAmount = totalAmount.toLocaleString('en-IN')

          // Get merge count for the target message (nextMsg at i+1)
          let targetMergeCount = mergeCounts.get(i + 1)
          if (targetMergeCount === undefined) {
            const targetMergeMatch = nextMsg.body.match(/\[Merged:\s*(\d+)\s*messages?\]/i)
            if (targetMergeMatch && targetMergeMatch[1]) {
              targetMergeCount = parseInt(targetMergeMatch[1], 10)
            } else {
              targetMergeCount = 1 // Original message counts as 1
            }
          }

          // Get merge count for the current message being merged (currentMsg at i)
          let currentMergeCount = mergeCounts.get(i)
          if (currentMergeCount === undefined) {
            const currentMergeMatch = currentMsg.body.match(/\[Merged:\s*(\d+)\s*messages?\]/i)
            if (currentMergeMatch && currentMergeMatch[1]) {
              currentMergeCount = parseInt(currentMergeMatch[1], 10)
            } else {
              currentMergeCount = 1 // Original message counts as 1
            }
          }

          // Total merge count = target count + current count
          const newMergeCount = targetMergeCount + currentMergeCount
          mergeCounts.set(i + 1, newMergeCount)

          // Update the older message (nextMsg) with merged amount
          // Replace "credited by Rs. X" format
          if (nextMsg.body) {
            nextMsg.body = nextMsg.body.replace(
              /(credited\s+by\s+Rs\.)\s*[\d,]+(?:\.\d{2})?/i,
              `$1 ${formattedAmount}`
            )

            // Update timestamp to the latest (newer) message's timestamp
            workingMessages[i + 1].timestamp = currentMsg.timestamp

            // Update phone number to the latest (newer) message's phone
            workingMessages[i + 1].phone = currentMsg.phone

            // Add merge count indicator to the message body
            // Remove existing merge count if present
            nextMsg.body = nextMsg.body.replace(/\s*\[Merged:\s*\d+\s*messages?\]/i, '')
            // Add new merge count
            nextMsg.body += ` [Merged: ${newMergeCount} message${newMergeCount > 1 ? 's' : ''}]`
          }

          // Mark current (newer) message to skip - don't display it
          skipIndices.add(i)
        }
      }
    }

    // Return only messages that weren't skipped
    return workingMessages.filter((_, index) => !skipIndices.has(index))
  },
}

/**
 * No Processing Processor (Pass-through)
 * Returns messages as-is without any processing
 */
export const noProcessingProcessor: MessageProcessor = {
  id: 'no-processing',
  name: 'No Processing',
  description: 'No processing applied - shows all messages as received',
  process: (messages: Message[], options?: Record<string, any>): Message[] => {
    return messages
  },
}

/**
 * Registry of all available processors
 */
export const messageProcessors: MessageProcessor[] = [
  noProcessingProcessor,
  neftInrMergeProcessor,
  iobMergeProcessor,
]

/**
 * Get processor by ID
 */
export const getProcessorById = (id: string): MessageProcessor | undefined => {
  return messageProcessors.find(p => p.id === id)
}

/**
 * Get default processor
 */
export const getDefaultProcessor = (): MessageProcessor => {
  return neftInrMergeProcessor
}
