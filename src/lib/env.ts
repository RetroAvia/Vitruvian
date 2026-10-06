/**
 * Variabili d'ambiente pubbliche.
 * I riferimenti a process.env.NEXT_PUBLIC_* devono essere LETTERALI:
 * Next.js li sostituisce al build time anche nel bundle client.
 */
function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Variabile d'ambiente mancante: ${name}. Copiala in .env.local (locale) e nelle Environment Variables di Vercel.`,
    )
  }
  return value
}

export const env = {
  supabaseUrl: required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseKey: required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ),
} as const
