import { formatNumber, isNum } from "@/lib/format"

interface ItemLike {
  food_name: string
  quantity: number | null
  unit: string | null
  alternative_group: number | null
}

/** Alimenti del pasto in una riga, con le alternative raggruppate: "uova 2 pz, (pane 50 g oppure fette 30 g)". */
export function mealText(items: ItemLike[], sep = ", ") {
  const parts: string[] = []
  const groups = new Map<number, string[]>()
  const label = (i: ItemLike) => `${i.food_name}${isNum(i.quantity) ? ` ${formatNumber(i.quantity, 0)}${i.unit ? ` ${i.unit}` : ""}` : ""}`
  for (const i of items) {
    if (i.alternative_group === null) parts.push(label(i))
    else {
      if (!groups.has(i.alternative_group)) {
        groups.set(i.alternative_group, [])
        parts.push(`__g${i.alternative_group}`)
      }
      groups.get(i.alternative_group)?.push(label(i))
    }
  }
  return parts
    .map((p) => {
      if (!p.startsWith("__g")) return p
      const g = groups.get(Number(p.slice(3))) ?? []
      return g.length > 1 ? `(${g.join(" oppure ")})` : (g[0] ?? "")
    })
    .join(sep)
}
