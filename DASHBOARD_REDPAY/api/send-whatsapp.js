/**
 * Vercel serverless function for sending WhatsApp messages
 * POST /api/send-whatsapp
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

    const response = await fetch('https://blacksms.in/whatsapp', {
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
    console.error('Error sending WhatsApp:', error)
    return res.status(500).json({
      error: 'Failed to send WhatsApp',
      message: error.message,
    })
  }
}
