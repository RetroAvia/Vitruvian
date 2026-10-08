/**
 * Invio di notifiche Web Push senza librerie esterne (solo `node:crypto`):
 *  - cifratura del contenuto "aes128gcm" (RFC 8291 / RFC 8188)
 *  - autenticazione VAPID con token JWT ES256 (RFC 8292)
 * Funziona con il servizio push di Apple (iPhone, app aggiunta alla Home),
 * di Google (Chrome/Android) e di Mozilla.
 */
import "server-only"

import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto"

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export interface VapidKeys {
  publicKey: string
  privateKey: string
  subject: string
}

const b64u = (b: Buffer) => b.toString("base64url")
const fromB64u = (s: string) => Buffer.from(s.replace(/=+$/, ""), "base64url")
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest()

/** Cifra il messaggio per un singolo browser (un solo record, nessun padding). */
export function encryptPayload(payload: Buffer, uaPublicB64: string, authB64: string, opts?: { salt?: Buffer; ecdhPrivate?: Buffer }) {
  const uaPublic = fromB64u(uaPublicB64)
  const authSecret = fromB64u(authB64)
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Chiavi della sottoscrizione non valide")

  const ecdh = createECDH("prime256v1")
  if (opts?.ecdhPrivate) ecdh.setPrivateKey(opts.ecdhPrivate)
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(uaPublic)

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0 || ua_public || as_public, 32)
  const prkKey = hmac(authSecret, shared)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])])
  const ikm = hmac(prkKey, keyInfo)

  const salt = opts?.salt ?? randomBytes(16)
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16)
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12)

  const cipher = createCipheriv("aes-128-gcm", cek, nonce)
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])

  const rs = Buffer.alloc(4)
  rs.writeUInt32BE(4096)
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic])
  return Buffer.concat([header, body])
}

/** Token VAPID (JWT ES256) per l'origine del servizio push. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()) {
  const pub = fromB64u(keys.publicKey)
  if (pub.length !== 65) throw new Error("Chiave pubblica VAPID non valida")
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: keys.privateKey.replace(/=+$/, ""), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  })
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = b64u(
    Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })),
  )
  const data = `${header}.${claims}`
  const signature = sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" })
  return `vapid t=${data}.${b64u(signature)}, k=${keys.publicKey.replace(/=+$/, "")}`
}

/** Servizi push ammessi (niente richieste verso indirizzi arbitrari). */
const ALLOWED_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.googleapis\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.notify\.windows\.com$/]

export function isAllowedEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint)
    return u.protocol === "https:" && ALLOWED_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

/**
 * Invia la notifica. Restituisce lo stato HTTP del servizio push:
 * 201 = consegnata, 404/410 = sottoscrizione scaduta (va cancellata).
 */
export async function sendPush(target: PushTarget, message: unknown, keys: VapidKeys, ttlSeconds = 120): Promise<number> {
  if (!isAllowedEndpoint(target.endpoint)) return 400
  const body = encryptPayload(Buffer.from(JSON.stringify(message)), target.p256dh, target.auth)
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(target.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "high",
    },
    body: new Uint8Array(body),
    cache: "no-store",
  })
  return res.status
}

/** Chiavi VAPID dalle variabili d'ambiente (null se le notifiche non sono configurate). */
export function vapidFromEnv(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:notifiche@vitruvian.app" }
}
