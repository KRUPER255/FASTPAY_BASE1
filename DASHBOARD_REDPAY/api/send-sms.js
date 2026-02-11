/**
 * Vercel serverless function for sending SMS
 * POST /api/send-sms
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  try {
    const { numbers, variables_values, sender_id } = req.body

    if (!numbers || !variables_values) {
      return res.status(400).json({ error: 'Missing required fields: numbers, variables_values' })
    }

    // Get auth token from environment variable
    const BLACKSMS_AUTH_TOKEN =
      process.env.BLACKSMS_AUTH_TOKEN || process.env.VITE_BLACKSMS_AUTH_TOKEN || ''

    if (!BLACKSMS_AUTH_TOKEN) {
      return res
        .status(500)
        .json({ error: 'Server configuration error: BLACKSMS_AUTH_TOKEN not set' })
    }

    const response = await fetch('https://blacksms.in/sms', {
      method: 'POST',
      headers: {
        Authorization: BLACKSMS_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_id: sender_id || '47',
        variables_values: variables_values,
        numbers: numbers,
      }),
    })

    let data
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = { message: text || 'Response received' }
    }

    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Error sending SMS:', error)
    return res.status(500).json({
      error: 'Failed to send SMS',
      message: error.message,
    })
  }
}
