/** Indicazioni tecniche essenziali (3 punti) per gli esercizi principali e per schema motorio. */
import type { Pattern } from "./catalog"

const SPECIFIC: Record<string, string[]> = {
  bench_press: ["Scapole addotte e depresse, piedi saldi a terra", "Bilanciere sotto al capezzolo, gomiti a ~45°", "Spingi in diagonale verso il viso senza staccare i glutei"],
  incline_bench_press: ["Panca a 30° (non di più)", "Bilanciere verso la parte alta del petto", "Scapole ferme, polsi sopra i gomiti"],
  dumbbell_bench_press: ["Manubri allineati al petto in basso", "Discesa lenta e controllata, allungamento completo", "Non sbattere i manubri in alto"],
  incline_dumbbell_press: ["Panca a 30°", "Gomiti leggermente sotto le spalle", "Massimo allungamento in basso"],
  dips: ["Busto leggermente inclinato in avanti per il petto", "Scendi finché la spalla è all'altezza del gomito", "Spalle basse, lontane dalle orecchie"],
  pull_up: ["Parti da braccia tese e scapole attive", "Porta il petto verso la sbarra, gomiti verso i fianchi", "Niente slanci: controlla la discesa"],
  lat_pulldown: ["Busto leggermente inclinato indietro", "Tira con i gomiti verso il basso, non con le mani", "Barra all'altezza della clavicola"],
  barbell_row: ["Busto a 30–45° rispetto al pavimento, schiena neutra", "Tira verso l'ombelico", "Pausa di un attimo in contrazione"],
  dumbbell_row: ["Schiena parallela al pavimento e neutra", "Porta il gomito verso l'anca", "Allunga bene in basso"],
  seated_cable_row: ["Petto alto, schiena neutra", "Tira verso l'addome stringendo le scapole", "Non oscillare con il busto"],
  overhead_press: ["Glutei e addome contratti, niente iperlordosi", "Bilanciere sopra il centro del piede", "Testa che passa \"attraverso\" le braccia in alto"],
  lateral_raise: ["Busto leggermente in avanti", "Sali fino all'altezza delle spalle con i gomiti morbidi", "Discesa lenta, niente slancio"],
  back_squat: ["Piedi larghezza spalle, punte leggermente aperte", "Ginocchia nella direzione delle punte", "Scendi almeno con l'anca all'altezza del ginocchio, schiena neutra"],
  front_squat: ["Gomiti alti, bilanciere sulle spalle anteriori", "Busto verticale", "Spingi con tutto il piede"],
  leg_press: ["Zona lombare sempre appoggiata", "Ginocchia allineate ai piedi", "Non bloccare le ginocchia in alto"],
  bulgarian_split_squat: ["Piede posteriore sulla panca, passo lungo", "Busto leggermente avanti per i glutei", "Ginocchio anteriore stabile"],
  deadlift: ["Bilanciere sopra il centro del piede", "Schiena neutra, petto alto, spalle sopra il bilanciere", "Spingi il pavimento, il bilanciere sfiora le gambe"],
  romanian_deadlift: ["Ginocchia leggermente flesse e ferme", "Spingi l'anca indietro finché senti i femorali", "Bilanciere vicino alle cosce, schiena neutra"],
  hip_thrust: ["Scapole sulla panca, mento verso il petto", "Spingi con i talloni", "Contrazione dei glutei in alto, senza iperestendere la schiena"],
  standing_calf_raise: ["Allungamento completo in basso (1 secondo)", "Sali sulle punte fino in fondo", "Niente rimbalzi"],
  barbell_curl: ["Gomiti fermi ai fianchi", "Nessuno slancio con la schiena", "Discesa controllata fino a braccio teso"],
  incline_curl: ["Panca a 45–60°, braccia che pendono dietro al busto", "Allungamento completo del bicipite", "Gomiti fermi"],
  triceps_pushdown: ["Gomiti fermi accanto al busto", "Estensione completa in basso", "Risalita controllata"],
  overhead_triceps_extension: ["Gomiti stretti e rivolti in avanti", "Scendi fino al massimo allungamento", "Busto stabile, addome contratto"],
  face_pull: ["Corda all'altezza del viso", "Tira separando le mani, gomiti alti", "Ruota le spalle in fuori a fine movimento"],
  plank: ["Corpo in linea da testa a talloni", "Glutei e addome contratti", "Respira senza perdere la posizione"],
}

const BY_PATTERN: Record<Pattern, string[]> = {
  squat: ["Schiena neutra e addome contratto", "Ginocchia allineate alle punte", "Spingi con tutto il piede"],
  hinge: ["Il movimento parte dall'anca, non dalla schiena", "Schiena neutra in ogni ripetizione", "Carico vicino al corpo"],
  lunge: ["Busto stabile", "Ginocchio anteriore allineato al piede", "Spingi con il tallone anteriore"],
  horizontal_push: ["Scapole stabili e addotte", "Gomiti non troppo aperti", "Discesa controllata"],
  vertical_push: ["Addome e glutei contratti", "Niente iperlordosi lombare", "Spingi in verticale"],
  horizontal_pull: ["Petto alto, schiena neutra", "Tira con i gomiti", "Stringi le scapole in contrazione"],
  vertical_pull: ["Parti con le scapole attive", "Gomiti verso i fianchi", "Controlla la fase di ritorno"],
  isolation: ["Movimento lento e controllato", "Ampiezza completa", "Nessuno slancio"],
  core: ["Bacino neutro", "Espira in contrazione", "Qualità prima delle ripetizioni"],
  carry: ["Postura alta, spalle basse", "Passi corti e controllati", "Addome contratto"],
  cardio: ["Intensità a cui riesci a parlare a frasi brevi (zona 2)", "Aumenta la durata prima dell'intensità", "Idratati"],
}

export function exerciseCues(code: string, pattern: Pattern): string[] {
  return SPECIFIC[code] ?? BY_PATTERN[pattern]
}
