/**
 * Vercel serverless function for proxying phone data requests
 * GET/POST /api/phone-data/*
 */
export default async function handler(req, res) {
  try {
    // Get the path from the catch-all route
    const path = req.query.path || []
    const pathString = Array.isArray(path) ? path.join('/') : path

    // Construct the target URL
    const targetUrl = `http://18.162.131.251/BswFiops1221cfddaaaawsdYTA/phone/${pathString}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`

    // Forward the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: undefined,
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    })

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return res.status(response.status).json(data)
    } else {
      const text = await response.text()
      return res.status(response.status).send(text)
    }
  } catch (error) {
    console.error('Error proxying phone data:', error)
    return res.status(500).json({
      error: 'Failed to proxy request',
      message: error.message,
    })
  }
}
