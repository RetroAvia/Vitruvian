/**
 * Geometria "low-poly" del corpo umano (vista frontale e posteriore) in un
 * sistema di coordinate 200 × 450, asse di simmetria x = 100.
 * Le forme del lato sinistro vengono specchiate automaticamente.
 * Condivisa da mappa corporea e miniature degli esercizi (nessuna immagine
 * esterna: pochi KB di SVG, nitidi a ogni risoluzione).
 */
import type { Muscle } from "@/features/training/engine/catalog"

type Pt = [number, number]
export type View = "front" | "back"

export interface Shape {
  /** muscolo collegato (null = solo silhouette) */
  muscle: Muscle | null
  points: Pt[]
  /** true = forma centrale, non va specchiata */
  center?: boolean
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [200 - x, y] as Pt).reverse()

export const toPoints = (pts: Pt[]) => pts.map(([x, y]) => `${x},${y}`).join(" ")

/* ------------------------------- Silhouette ------------------------------- */

const HEAD: Pt[] = [[100, 12], [111, 16], [117, 28], [116, 42], [110, 52], [100, 56], [90, 52], [84, 42], [83, 28], [89, 16]]
const NECK: Pt[] = [[92, 50], [108, 50], [110, 68], [90, 68]]
const TORSO: Pt[] = [[76, 66], [124, 66], [142, 80], [140, 100], [133, 128], [127, 160], [125, 186], [131, 212], [130, 230], [70, 230], [69, 212], [75, 186], [73, 160], [67, 128], [60, 100], [58, 80]]
const ARM_L: Pt[] = [[58, 80], [64, 100], [66, 124], [64, 150], [60, 164], [57, 188], [50, 232], [36, 232], [34, 200], [40, 164], [42, 128], [44, 100], [48, 86]]
const HAND_L: Pt[] = [[36, 232], [50, 232], [52, 252], [44, 266], [34, 258], [32, 242]]
const LEG_L: Pt[] = [[70, 226], [100, 226], [99, 256], [94, 304], [90, 326], [90, 366], [86, 418], [76, 418], [72, 366], [72, 326], [68, 282], [66, 246]]
const FOOT_L: Pt[] = [[76, 416], [87, 416], [92, 432], [70, 434]]

export const SILHOUETTE: Pt[][] = [HEAD, NECK, TORSO, ARM_L, mirror(ARM_L), HAND_L, mirror(HAND_L), LEG_L, mirror(LEG_L), FOOT_L, mirror(FOOT_L)]

/* -------------------------------- Muscoli -------------------------------- */

const FOREARM_L: Pt[] = [[46, 162], [58, 160], [57, 180], [50, 226], [38, 228], [36, 200], [40, 176]]

const FRONT_L: Shape[] = [
  { muscle: "front_delts", points: [[64, 76], [78, 74], [76, 90], [68, 106], [62, 104], [60, 88]] },
  { muscle: "side_delts", points: [[60, 88], [62, 104], [57, 112], [47, 110], [44, 98], [49, 85], [64, 76]] },
  { muscle: "chest", points: [[78, 77], [99, 80], [99, 118], [89, 124], [77, 120], [69, 106], [76, 91]] },
  { muscle: "biceps", points: [[50, 112], [60, 110], [64, 124], [62, 148], [56, 160], [48, 150], [46, 128]] },
  { muscle: "forearms", points: FOREARM_L },
  { muscle: "abs", points: [[76, 124], [87, 128], [85, 160], [87, 198], [78, 190], [74, 160]] },
  { muscle: "quads", points: [[71, 230], [94, 228], [97, 240], [93, 296], [86, 320], [77, 316], [70, 286], [68, 250]] },
  { muscle: "adductors", points: [[95, 230], [100, 232], [99, 258], [94, 284], [94, 250]] },
  { muscle: "calves", points: [[75, 334], [88, 332], [89, 358], [85, 410], [78, 410], [73, 366]] },
]

const FRONT_CENTER: Shape[] = [
  { muscle: "upper_back", points: [[90, 66], [110, 66], [118, 74], [100, 78], [82, 74]], center: true },
  { muscle: "abs", points: [[88, 126], [112, 126], [114, 160], [112, 196], [100, 210], [88, 196], [86, 160]], center: true },
]

const BACK_L: Shape[] = [
  { muscle: "rear_delts", points: [[58, 82], [76, 78], [78, 90], [68, 104], [56, 110], [45, 100], [48, 87]] },
  { muscle: "lats", points: [[78, 92], [88, 108], [98, 126], [97, 164], [88, 184], [78, 170], [72, 140], [70, 112]] },
  { muscle: "triceps", points: [[48, 112], [60, 108], [64, 122], [62, 148], [56, 160], [46, 148], [44, 126]] },
  { muscle: "forearms", points: FOREARM_L },
  { muscle: "glutes", points: [[70, 210], [99, 208], [99, 246], [86, 254], [72, 248], [68, 228]] },
  { muscle: "hamstrings", points: [[70, 252], [97, 252], [95, 300], [88, 322], [78, 320], [72, 296]] },
  { muscle: "calves", points: [[73, 330], [89, 328], [91, 360], [85, 396], [77, 396], [72, 362]] },
]

const BACK_CENTER: Shape[] = [
  { muscle: "upper_back", points: [[100, 58], [116, 72], [122, 84], [112, 104], [100, 124], [88, 104], [78, 84], [84, 72]], center: true },
  { muscle: "lower_back", points: [[90, 168], [110, 168], [113, 200], [100, 210], [87, 200]], center: true },
]

function build(left: Shape[], center: Shape[]): Shape[] {
  const out: Shape[] = [...center]
  for (const s of left) out.push(s, { muscle: s.muscle, points: mirror(s.points) })
  return out
}

export const MUSCLE_SHAPES: Record<View, Shape[]> = {
  front: build(FRONT_L, FRONT_CENTER),
  back: build(BACK_L, BACK_CENTER),
}

/** Linee decorative (addominali, ginocchia, sterno) per il look "tecnico". */
export const DETAIL_LINES: Record<View, Array<[Pt, Pt]>> = {
  front: [
    [[100, 82], [100, 206]],
    [[88, 150], [112, 150]],
    [[88, 174], [112, 174]],
    [[78, 322], [90, 326]],
    [[122, 322], [110, 326]],
  ],
  back: [
    [[100, 60], [100, 210]],
    [[78, 324], [92, 326]],
    [[122, 324], [108, 326]],
  ],
}

/** In quale vista un muscolo è più visibile (per le miniature). */
export const BEST_VIEW: Record<Muscle, View> = {
  chest: "front",
  front_delts: "front",
  side_delts: "front",
  biceps: "front",
  forearms: "front",
  abs: "front",
  quads: "front",
  adductors: "front",
  calves: "back",
  lats: "back",
  upper_back: "back",
  rear_delts: "back",
  triceps: "back",
  glutes: "back",
  hamstrings: "back",
  lower_back: "back",
}

/** Punti di ancoraggio delle circonferenze (vista frontale). */
export const SITE_ANCHORS: Record<string, { at: Pt; side: "left" | "right" }> = {
  neck: { at: [100, 60], side: "right" },
  shoulders: { at: [138, 88], side: "right" },
  chest: { at: [112, 100], side: "right" },
  arm_left: { at: [52, 132], side: "left" },
  arm_right: { at: [148, 132], side: "right" },
  forearm_left: { at: [44, 196], side: "left" },
  forearm_right: { at: [156, 196], side: "right" },
  waist: { at: [76, 184], side: "left" },
  hips: { at: [130, 222], side: "right" },
  thigh_left: { at: [76, 272], side: "left" },
  thigh_right: { at: [124, 272], side: "right" },
  calf_left: { at: [78, 368], side: "left" },
  calf_right: { at: [122, 368], side: "right" },
}

/* ------------------------------ Figura femminile ------------------------------ */

export type BodyFigure = "male" | "female"

/**
 * Larghezza relativa per quota (y → fattore): spalle e vita più strette,
 * fianchi e attacco coscia più ampi. Stesse forme e muscoli della figura
 * maschile, "deformate" orizzontalmente attorno all'asse x = 100.
 */
const FEMALE_WIDTH: Array<[number, number]> = [
  [0, 1],
  [56, 1],
  [64, 0.92],
  [80, 0.88],
  [104, 0.9],
  [130, 0.88],
  [172, 0.84],
  [192, 0.88],
  [214, 1.04],
  [232, 1.07],
  [262, 1.04],
  [330, 1],
  [452, 1],
]

function widthAt(y: number): number {
  for (let i = 1; i < FEMALE_WIDTH.length; i++) {
    const [y1, k1] = FEMALE_WIDTH[i] as [number, number]
    const [y0, k0] = FEMALE_WIDTH[i - 1] as [number, number]
    if (y <= y1) return k0 + ((k1 - k0) * (y - y0)) / (y1 - y0)
  }
  return 1
}

const warp = ([x, y]: Pt): Pt => [Math.round((100 + (x - 100) * widthAt(y)) * 10) / 10, y]

export interface BodyGeometry {
  silhouette: Pt[][]
  muscles: Record<View, Shape[]>
  details: Record<View, Array<[Pt, Pt]>>
  anchors: Record<string, { at: Pt; side: "left" | "right" }>
  /** trasforma un punto della figura base (marcatori) */
  place: (p: Pt) => Pt
}

const MALE: BodyGeometry = { silhouette: SILHOUETTE, muscles: MUSCLE_SHAPES, details: DETAIL_LINES, anchors: SITE_ANCHORS, place: (p) => p }
let female: BodyGeometry | null = null

/** Geometria della figura (calcolata una sola volta). */
export function bodyGeometry(figure: BodyFigure = "male"): BodyGeometry {
  if (figure === "male") return MALE
  female ??= {
    silhouette: SILHOUETTE.map((p) => p.map(warp)),
    muscles: {
      front: MUSCLE_SHAPES.front.map((s) => ({ ...s, points: s.points.map(warp) })),
      back: MUSCLE_SHAPES.back.map((s) => ({ ...s, points: s.points.map(warp) })),
    },
    details: {
      front: DETAIL_LINES.front.map(([a, b]) => [warp(a), warp(b)] as [Pt, Pt]),
      back: DETAIL_LINES.back.map(([a, b]) => [warp(a), warp(b)] as [Pt, Pt]),
    },
    anchors: Object.fromEntries(Object.entries(SITE_ANCHORS).map(([k, v]) => [k, { ...v, at: warp(v.at) }])),
    place: warp,
  }
  return female
}
