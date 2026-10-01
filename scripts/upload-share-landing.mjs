/**
 * Uploads public/share/index.html to the public R2 bucket.
 *
 * The share landing page cannot be served by the `share-redeem` edge function:
 * Supabase's gateway rewrites any text/html response to text/plain, so a browser
 * is shown the source instead of a rendered page. The page therefore lives in
 * the bucket, and the function redirects to it.
 *
 * R2 credentials are read from .env and never printed. The public base URL is
 * passed explicitly, because the r2.dev subdomain is not the account id.
 *
 * Usage:
 *   node scripts/upload-share-landing.mjs [public-base-url]
 */
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const envPath = join(root, '.env')
const htmlPath = join(root, 'public', 'share', 'index.html')
const objectKey = 'share/index.html'

const env = {}
const commented = {}
for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim()
  if (!line) continue
  const isComment = line.startsWith('#')
  const body = isComment ? line.replace(/^#+\s*/, '') : line
  const eq = body.indexOf('=')
  if (eq === -1) continue
  const key = body.slice(0, eq).trim()
  if (!/^[A-Z0-9_]+$/.test(key)) continue
  let value = body.slice(eq + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  ;(isComment ? commented : env)[key] = value
}
for (const [k, v] of Object.entries(commented)) if (!env[k]) env[k] = v

const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT']
  .filter((k) => !env[k] || env[k].startsWith('your_'))
if (missing.length) {
  console.error(`Missing R2 configuration in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const accountId = env.R2_ACCOUNT_ID
const host = new URL(env.R2_ENDPOINT).host
const publicBase = (process.argv[2] || `https://pub-${accountId}.r2.dev`).replace(/\/+$/, '')

const REGION = 'auto'
const SERVICE = 's3'
const ALGORITHM = 'AWS4-HMAC-SHA256'
const enc = (k) => k.split('/').map(encodeURIComponent).join('/')
const hmac = (key, data) => createHmac('sha256', key).update(data, 'utf8').digest()

function presign(method, key) {
  const now = new Date()
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const credential = `${env.R2_ACCESS_KEY_ID}/${stamp}/${REGION}/${SERVICE}/aws4_request`
  const query = [
    ['X-Amz-Algorithm', ALGORITHM],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amz],
    ['X-Amz-Expires', '900'],
    ['X-Amz-SignedHeaders', 'host'],
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const canonicalRequest = [
    method,
    `/${env.R2_BUCKET_NAME}/${enc(key)}`,
    query,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    ALGORITHM,
    amz,
    scope,
    createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n')
  let signingKey = Buffer.from(`AWS4${env.R2_SECRET_ACCESS_KEY}`, 'utf8')
  for (const part of [stamp, REGION, SERVICE, 'aws4_request']) signingKey = hmac(signingKey, part)
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex')
  return `https://${host}/${env.R2_BUCKET_NAME}/${enc(key)}?${query}&X-Amz-Signature=${signature}`
}

const body = readFileSync(htmlPath)
const put = await fetch(presign('PUT', objectKey), {
  method: 'PUT',
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
  body,
})
if (!put.ok) {
  console.error(`PUT failed: ${put.status}`)
  console.error((await put.text()).slice(0, 400))
  process.exit(1)
}

const url = `${publicBase}/${enc(objectKey)}`
const res = await fetch(url)
const text = await res.text()
console.log(`uploaded ${statSync(htmlPath).size} bytes -> ${objectKey}`)
console.log(`public GET ${res.status}  content-type=${res.headers.get('content-type')}`)
console.log(`identical: ${text === body.toString()}`)
console.log(`url: ${url}`)
console.log('\nSet this on the function if the URL changed:')
console.log(`  supabase secrets set --project-ref <ref> SHARE_LANDING_URL=${url}`)
