import fs from 'fs'
import path from 'path'

const distDir = path.resolve(__dirname, '../../../dist')
const indexPath = path.join(distDir, 'index.html')

const normalizeAssetPath = (assetPath: string) => {
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return null
  }
  const cleaned = assetPath.replace(/^\.?\//, '')
  return path.join(distDir, cleaned)
}

describe('Dashboard production build artifacts', () => {
  it('has a built index.html', () => {
    expect(fs.existsSync(indexPath)).toBe(true)
    const html = fs.readFileSync(indexPath, 'utf-8')
    expect(html.trim().length).toBeGreaterThan(0)
  })

  it('references existing JS/CSS assets and mounts the app', () => {
    const html = fs.readFileSync(indexPath, 'utf-8')
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const root = doc.querySelector('#root')
    expect(root).not.toBeNull()

    const scriptSrcs = Array.from(doc.querySelectorAll('script[src]'))
      .map(node => node.getAttribute('src'))
      .filter((value): value is string => Boolean(value))
    expect(scriptSrcs.length).toBeGreaterThan(0)

    const stylesheetHrefs = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))
      .map(node => node.getAttribute('href'))
      .filter((value): value is string => Boolean(value))

    const assetFiles = [...scriptSrcs, ...stylesheetHrefs]
      .map(assetPath => normalizeAssetPath(assetPath))
      .filter((value): value is string => Boolean(value))

    assetFiles.forEach(assetPath => {
      expect(fs.existsSync(assetPath)).toBe(true)
      expect(fs.statSync(assetPath).size).toBeGreaterThan(0)
    })

    const jsAssets = scriptSrcs
      .map(assetPath => normalizeAssetPath(assetPath))
      .filter((value): value is string => Boolean(value))
      .filter(assetPath => assetPath.endsWith('.js'))

    const jsContent = jsAssets.map(assetPath => fs.readFileSync(assetPath, 'utf-8')).join('\n')
    expect(
      jsContent.includes('createRoot') ||
        jsContent.includes('hydrateRoot') ||
        jsContent.includes('ReactDOM')
    ).toBe(true)
  })
})
