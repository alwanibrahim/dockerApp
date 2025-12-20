#!/usr/bin/env bun

const API = 'https://api.cloudflare.com/client/v4'

const TOKEN = process.env.CF_API_TOKEN
const ZONE_ID = process.env.CF_ZONE_ID

if (!TOKEN || !ZONE_ID) {
  throw new Error('CF_API_TOKEN atau CF_ZONE_ID belum diset')
}

/* =========================
   TYPES
========================= */
type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX'

interface DNSRecord {
  id: string
  type: DNSRecordType
  name: string
  content: string
  ttl: number
  proxied?: boolean
}

interface CFResponse<T> {
  success: boolean
  result: T
  errors: unknown[]
}

/* =========================
   CORE REQUEST
========================= */
async function cfRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  const json = (await res.json()) as CFResponse<T>

  if (!json.success) {
    console.error('Cloudflare API Error:', json.errors)
    process.exit(1)
  }

  return json.result
}

/* =========================
   1. LIST RECORDS
========================= */

function pad(str: string, len: number) {
  return str.length > len
    ? str.slice(0, len - 1) + '…'
    : str.padEnd(len)
}

async function listRecords() {
  const records = await cfRequest<DNSRecord[]>(
    `/zones/${ZONE_ID}/dns_records`
  )

  console.log(
    [
      pad('ID', 10),
      pad('TYPE', 6),
      pad('NAME', 30),
      pad('CONTENT', 18),
      pad('TTL', 6),
      'PROXY',
    ].join(' ')
  )

  console.log('-'.repeat(80))

  for (const r of records) {
    console.log(
      [

        pad(r.id, 36),
        pad(r.type, 6),
        pad(r.name, 30),
        pad(r.content, 18),
        pad(String(r.ttl), 6),
        r.proxied ? '🟢' : '⚪',
      ].join(' ')
    )
  }
}
/* =========================
   2. ADD RECORD
========================= */
async function addRecord(input: {
  type: DNSRecordType
  name: string
  content: string
  ttl?: number
  proxied?: boolean
}) {
  const record = await cfRequest<DNSRecord>(
    `/zones/${ZONE_ID}/dns_records`,
    {
      method: 'POST',
      body: JSON.stringify({
        ttl: 1,
        proxied: false,
        ...input,
      }),
    }
  )

  console.log('Record added:', record.id)
}

/* =========================
   3. UPDATE RECORD
========================= */

async function updateRecord(
  id: string,
  patch: Partial<Omit<DNSRecord, 'id'>>
) {
  // 1. Ambil record lama
  const current = await cfRequest<DNSRecord>(
    `/zones/${ZONE_ID}/dns_records/${id}`
  )

  // 2. Merge payload
  const payload = {
    type: current.type,
    name: current.name,
    content: current.content,
    ttl: current.ttl,
    proxied: current.proxied ?? false,
    ...patch,
  }

  // 3. Kirim PUT lengkap
  const record = await cfRequest<DNSRecord>(
    `/zones/${ZONE_ID}/dns_records/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  )

  console.log('Record updated:', record.id)
}


/* =========================
   4. DELETE RECORD
========================= */
async function deleteRecord(id: string) {
  await cfRequest(
    `/zones/${ZONE_ID}/dns_records/${id}`,
    { method: 'DELETE' }
  )

  console.log('Record deleted:', id)
}

/* =========================
   CLI HANDLER
========================= */
const [, , cmd, ...args] = process.argv

async function main() {
  switch (cmd) {
    case 'list':
      await listRecords()
      break

    case 'add':
      // bun run cf add A test.domain.com 1.1.1.1 true
      await addRecord({
        type: args[0] as DNSRecordType,
        name: args[1],
        content: args[2],
        proxied: args[3] === 'true',
      })
      break

    case 'update':
      // bun run cf update RECORD_ID content=8.8.8.8 proxied=false
      const id = args.shift()!
      const payload = Object.fromEntries(
        args.map(v => {
          const [k, val] = v.split('=')
          if (val === 'true') return [k, true]
          if (val === 'false') return [k, false]
          return [k, val]
        })
      )
      await updateRecord(id, payload)
      break

    case 'delete':
      await deleteRecord(args[0])
      break

    default:
      console.log(`
Usage:
  bun run cf list
  bun run cf add <TYPE> <NAME> <CONTENT> [proxied]
  bun run cf update <ID> key=value key=value
  bun run cf delete <ID>
`)
  }
}

main()
