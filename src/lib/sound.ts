"use client"

/**
 * Suoni d'interfaccia sintetizzati con Web Audio: niente file da scaricare,
 * volumi bassi, inviluppi morbidi (nessun "click"). Disattivabili in Impostazioni.
 */
import { useCallback } from "react"

import { useUiStore } from "@/stores/ui-store"

export type SoundName = "tap" | "check" | "uncheck" | "success" | "error" | "celebrate"

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

const RECIPES: Record<SoundName, (ac: AudioContext, t: number) => void> = {
  tap: (ac, t) => tone(ac, 880, t, 0.06, 0.025, "triangle"),
  check: (ac, t) => {
    tone(ac, 660, t, 0.09, 0.04)
    tone(ac, 990, t + 0.06, 0.12, 0.035)
  },
  uncheck: (ac, t) => tone(ac, 520, t, 0.08, 0.03, "triangle"),
  success: (ac, t) => {
    tone(ac, 523.25, t, 0.16, 0.045)
    tone(ac, 659.25, t + 0.08, 0.16, 0.045)
    tone(ac, 783.99, t + 0.16, 0.26, 0.045)
  },
  error: (ac, t) => {
    tone(ac, 311.13, t, 0.14, 0.04, "triangle")
    tone(ac, 233.08, t + 0.11, 0.2, 0.04, "triangle")
  },
  celebrate: (ac, t) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, f, t + i * 0.09, 0.3, 0.04))
  },
}

export function playSound(name: SoundName) {
  if (!useUiStore.getState().soundEnabled) return
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && name === "celebrate") return
  const ac = audio()
  if (!ac) return
  try {
    RECIPES[name](ac, ac.currentTime + 0.005)
  } catch {
    /* audio non disponibile: silenzio */
  }
}

/** Hook comodo per i componenti. */
export function useSound() {
  return useCallback((name: SoundName) => playSound(name), [])
}
