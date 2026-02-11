import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

// Get BlackSMS auth token from environment variable
const BLACKSMS_AUTH_TOKEN =
  process.env.BLACKSMS_AUTH_TOKEN || process.env.VITE_BLACKSMS_AUTH_TOKEN || ''

if (!BLACKSMS_AUTH_TOKEN) {
  console.warn('⚠️  WARNING: BLACKSMS_AUTH_TOKEN not set in environment variables!')
  console.warn(
    '⚠️  Please set BLACKSMS_AUTH_TOKEN or VITE_BLACKSMS_AUTH_TOKEN in your .env.local file'
  )
}

// Enable CORS for all routes
app.use(cors())
app.use(express.json())

// Proxy endpoint for SMS
app.post('/api/send-sms', async (req, res) => {
  try {
    const { numbers, variables_values, sender_id } = req.body

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
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Error sending SMS:', error)
    res.status(500).json({ error: 'Failed to send SMS', message: error.message })
  }
})

// Proxy endpoint for WhatsApp
app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { numbers, variables_values, sender_id } = req.body

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
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Error sending WhatsApp:', error)
    res.status(500).json({ error: 'Failed to send WhatsApp', message: error.message })
  }
})

// Proxy endpoint for Google OAuth token exchange
app.post('/api/auth/google/token', async (req, res) => {
  try {
    const { code } = req.body

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_SECRET =
      process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET
    const GOOGLE_REDIRECT_URI =
      process.env.GOOGLE_REDIRECT_URI || process.env.VITE_GOOGLE_REDIRECT_URI

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth credentials not configured on server' })
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Token exchange error:', error)
    res.status(500).json({ error: 'Failed to exchange token', message: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`)
})
