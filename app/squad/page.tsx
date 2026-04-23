"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  type InventoryPlayer,
  getInventory,
  getSquad,
  saveSquad,
  getFormationSlots,
} from "@/lib/storage"

type PositionPoint = {
  x: number
  y: number
  label: string
}

const formationLayouts: Record<string, Record<string, PositionPoint>> = {
  "4-3-3": {
    gk: { x: 50, y: 88, label: "GK" },
    lb: { x: 14, y: 71, label: "LB" },
    cb1: { x: 37, y: 68, label: "CB" },
    cb2: { x: 63, y: 68, label: "CB" },
    rb: { x: 86, y: 71, label: "RB" },
    cm1: { x: 26, y: 44, label: "CM" },
    cm2: { x: 50, y: 44, label: "CM" },
    cm3: { x: 74, y: 44, label: "CM" },
    lw: { x: 15, y: 18, label: "LW" },
    st: { x: 50, y: 14, label: "ST" },
    rw: { x: 85, y: 18, label: "RW" },
  },
  "4-4-2": {
    gk: { x: 50, y: 90, label: "GK" },
    lb: { x: 14, y: 70, label: "LB" },
    cb1: { x: 37, y: 74, label: "CB" },
    cb2: { x: 63, y: 74, label: "CB" },
    rb: { x: 86, y: 70, label: "RB" },
    lm: { x: 14, y: 45, label: "LM" },
    cm1: { x: 38, y: 50, label: "CM" },
    cm2: { x: 62, y: 50, label: "CM" },
    rm: { x: 86, y: 45, label: "RM" },
    st1: { x: 38, y: 15, label: "ST" },
    st2: { x: 62, y: 15, label: "ST" },
  },
  "4-2-3-1": {
    gk: { x: 50, y: 90, label: "GK" },
    lb: { x: 14, y: 70, label: "LB" },
    cb1: { x: 37, y: 74, label: "CB" },
    cb2: { x: 63, y: 74, label: "CB" },
    rb: { x: 86, y: 70, label: "RB" },
    cdm1: { x: 38, y: 56, label: "CDM" },
    cdm2: { x: 62, y: 56, label: "CDM" },
    lw: { x: 16, y: 28, label: "LW" },
    cam: { x: 50, y: 34, label: "CAM" },
    rw: { x: 84, y: 28, label: "RW" },
    st: { x: 50, y: 12, label: "ST" },
  },
}

function normalizePositionText(position: string): string {
  return position.trim().toUpperCase()
}

function normalizeSlotToPosition(slotName: string): string {
  const lower = slotName.toLowerCase()

  if (lower.startsWith("st")) return "ST"
  if (lower.startsWith("cb")) return "CB"
  if (lower.startsWith("cm")) return "CM"
  if (lower.startsWith("cdm")) return "CDM"
  if (lower.startsWith("cam")) return "CAM"
  if (lower.startsWith("lw")) return "LW"
  if (lower.startsWith("rw")) return "RW"
  if (lower.startsWith("lm")) return "LM"
  if (lower.startsWith("rm")) return "RM"
  if (lower.startsWith("lb")) return "LB"
  if (lower.startsWith("rb")) return "RB"
  if (lower.startsWith("gk")) return "GK"

  return lower.toUpperCase()
}

function getPositionGroup(position: string): "gk" | "defense" | "midfield" | "attack" {
  const pos = normalizePositionText(position)

  if (pos === "GK") return "gk"
  if (["LB", "RB", "CB"].includes(pos)) return "defense"
  if (["CM", "CDM", "CAM", "LM", "RM"].includes(pos)) return "midfield"
  return "attack"
}

function isAltPosition(player: InventoryPlayer, slotName: string) {
  const slotPos = normalizeSlotToPosition(slotName)
  const altPositions = (player.altPositions ?? []).map((p) => normalizePositionText(p))
  return altPositions.includes(slotPos)
}

function getPositionPenalty(player: InventoryPlayer, slotName: string): number {
  const playerPos = normalizePositionText(player.position)
  const slotPos = normalizeSlotToPosition(slotName)

  if (playerPos === slotPos) return 0
  if (isAltPosition(player, slotName)) return 0

  const playerGroup = getPositionGroup(playerPos)
  const slotGroup = getPositionGroup(slotPos)

  if (playerGroup === "gk" || slotGroup === "gk") return 50

  if (playerPos === "ST" && ["LW", "RW", "LM", "RM"].includes(slotPos)) return 1
  if (playerPos === "ST" && ["CM", "CDM", "CAM"].includes(slotPos)) return 6
  if (playerPos === "ST" && ["LB", "RB", "CB"].includes(slotPos)) return 10

  if (["LW", "RW", "LM", "RM"].includes(playerPos) && slotPos === "ST") return 1

  if (
    (playerGroup === "attack" && slotGroup === "midfield") ||
    (playerGroup === "midfield" && slotGroup === "attack")
  ) {
    return 6
  }

  if (
    (playerGroup === "attack" && slotGroup === "defense") ||
    (playerGroup === "defense" && slotGroup === "attack")
  ) {
    return 10
  }

  if (
    (playerGroup === "midfield" && slotGroup === "defense") ||
    (playerGroup === "defense" && slotGroup === "midfield")
  ) {
    return 6
  }

  return 6
}

function getAdjustedRating(player: InventoryPlayer, slotName: string) {
  return Math.max(1, player.rating - getPositionPenalty(player, slotName))
}

function calculateSquadOvr(
  visibleSlots: string[],
  inventory: InventoryPlayer[],
  slots: Record<string, string | null>
) {
  if (visibleSlots.length === 0) return 0

  const total = visibleSlots.reduce((sum, slotName) => {
    const playerId = slots[slotName]
    if (!playerId) return sum

    const player = inventory.find((p) => p.id === playerId)
    if (!player) return sum

    return sum + getAdjustedRating(player, slotName)
  }, 0)

  return Math.round(total / visibleSlots.length)
}

function sanitizeSlotsByName(
  slots: Record<string, string | null>,
  inventory: InventoryPlayer[]
) {
  const seenNames = new Set<string>()
  const cleaned: Record<string, string | null> = {}

  for (const [slot, playerId] of Object.entries(slots)) {
    if (!playerId) {
      cleaned[slot] = null
      continue
    }

    const player = inventory.find((p) => p.id === playerId)
    if (!player) {
      cleaned[slot] = null
      continue
    }

    const normalizedName = player.name.trim().toLowerCase()

    if (seenNames.has(normalizedName)) {
      cleaned[slot] = null
    } else {
      cleaned[slot] = playerId
      seenNames.add(normalizedName)
    }
  }

  return cleaned
}

function findPlayerOwnerSlotByName(
  slots: Record<string, string | null>,
  inventory: InventoryPlayer[],
  playerName: string
) {
  const normalizedName = playerName.trim().toLowerCase()

  for (const [slotName, playerId] of Object.entries(slots)) {
    if (!playerId) continue
    const player = inventory.find((p) => p.id === playerId)
    if (!player) continue

    if (player.name.trim().toLowerCase() === normalizedName) {
      return slotName
    }
  }

  return null
}

export default function SquadPage() {
  const [inventory, setInventory] = useState<InventoryPlayer[]>([])
  const [formation, setFormation] = useState("4-3-3")
  const [slots, setSlots] = useState<Record<string, string | null>>({})
  const [activeSlot, setActiveSlot] = useState<string | null>(null)

  useEffect(() => {
    const inv = getInventory()
    const squad = getSquad()

    const loadedFormation = squad.formation || "4-3-3"
    const loadedSlots = sanitizeSlotsByName(squad.slots || {}, inv)

    setInventory(inv)
    setFormation(loadedFormation)
    setSlots(loadedSlots)

    saveSquad({
      formation: loadedFormation,
      slots: loadedSlots,
    })
  }, [])

  const layout = formationLayouts[formation]
  const visibleSlots = useMemo(() => getFormationSlots(formation), [formation])

  const squadOvr = useMemo(() => {
    return calculateSquadOvr(visibleSlots, inventory, slots)
  }, [visibleSlots, inventory, slots])

  useEffect(() => {
    if (inventory.length === 0) return

    const cleaned = sanitizeSlotsByName(slots, inventory)
    if (JSON.stringify(cleaned) !== JSON.stringify(slots)) {
      setSlots(cleaned)
      saveSquad({
        formation,
        slots: cleaned,
      })
    }
  }, [slots, inventory, formation])

  function changeFormation(nextFormation: string) {
    const nextSlotNames = getFormationSlots(nextFormation)
    const nextSlots: Record<string, string | null> = {}

    for (const slot of nextSlotNames) {
      nextSlots[slot] = null
    }

    const currentPlayerIds = Object.values(slots).filter(Boolean) as string[]
    const usedNames = new Set<string>()
    let insertIndex = 0

    for (const playerId of currentPlayerIds) {
      const player = inventory.find((p) => p.id === playerId)
      if (!player) continue

      const normalizedName = player.name.trim().toLowerCase()
      if (usedNames.has(normalizedName)) continue
      if (insertIndex >= nextSlotNames.length) break

      nextSlots[nextSlotNames[insertIndex]] = playerId
      usedNames.add(normalizedName)
      insertIndex++
    }

    const cleaned = sanitizeSlotsByName(nextSlots, inventory)

    setFormation(nextFormation)
    setSlots(cleaned)
    saveSquad({
      formation: nextFormation,
      slots: cleaned,
    })
    setActiveSlot(null)
  }

  function assignPlayerToSlot(playerId: string) {
    if (!activeSlot) return

    const player = inventory.find((p) => p.id === playerId)
    if (!player) return

    const nextSlots = { ...slots }

    const existingSlot = findPlayerOwnerSlotByName(nextSlots, inventory, player.name)
    if (existingSlot) {
      nextSlots[existingSlot] = null
    }

    nextSlots[activeSlot] = playerId

    const cleaned = sanitizeSlotsByName(nextSlots, inventory)

    setSlots(cleaned)
    saveSquad({
      formation,
      slots: cleaned,
    })
    setActiveSlot(null)
  }

  function removeFromSlot(slotName: string) {
    const nextSlots = {
      ...slots,
      [slotName]: null,
    }

    setSlots(nextSlots)
    saveSquad({
      formation,
      slots: nextSlots,
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.15),transparent_22%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.45em] text-cyan-300">Squad Builder</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black">Build Your Team</h1>
              <p className="mt-2 text-slate-300">Pick a formation and place your players.</p>
            </div>

            <div className="flex gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400">Squad OVR</div>
                <div className="text-2xl font-black">{squadOvr}</div>
              </div>

              <Link
                href="/"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Main Menu
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">Formation</h2>

              <select
                value={formation}
                onChange={(e) => changeFormation(e.target.value)}
                className="rounded-2xl border border-white/10 bg-black/40 px-5 py-3 text-xl text-white outline-none"
              >
                <option value="4-3-3">4-3-3</option>
                <option value="4-4-2">4-4-2</option>
                <option value="4-2-3-1">4-2-3-1</option>
              </select>
            </div>

            <div className="relative min-h-[980px] overflow-hidden rounded-[40px] border border-emerald-300/20 bg-gradient-to-b from-emerald-700 to-emerald-800 p-8 shadow-[inset_0_0_80px_rgba(0,0,0,0.18)]">
              <div className="absolute inset-8 rounded-[34px] border border-white/10" />
              <div className="absolute bottom-8 left-1/2 top-8 w-px -translate-x-1/2 bg-white/10" />
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
              <div className="absolute left-1/2 top-8 h-14 w-32 -translate-x-1/2 rounded-b-[60px] border border-white/10 border-t-0" />
              <div className="absolute bottom-8 left-1/2 h-14 w-32 -translate-x-1/2 rounded-t-[60px] border border-white/10 border-b-0" />

              {visibleSlots.map((slotName) => {
                const point = layout[slotName]
                const player = inventory.find((p) => p.id === slots[slotName])

                if (!point) return null

                const adjusted = player ? getAdjustedRating(player, slotName) : null
                const penalty = player ? getPositionPenalty(player, slotName) : 0

                return (
                  <div
                    key={slotName}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                    }}
                  >
                    <div className="flex flex-col items-center">
                      {player ? (
                        <>
                          <button
                            onClick={() => setActiveSlot(slotName)}
                            className="group relative transition hover:scale-105"
                          >
                            <Image
                              src={player.cardImage}
                              alt={player.name}
                              width={120}
                              height={170}
                              className="rounded-2xl object-cover drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)]"
                            />
                            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-transparent transition group-hover:ring-cyan-300/80" />
                          </button>

                          <div className="mt-2 text-center">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-100">
                              {point.label}
                            </div>
                            <div className="max-w-[120px] truncate text-sm font-bold text-white">
                              {player.name}
                            </div>
                            <div className="text-xs text-slate-200">
                              OVR {adjusted}
                              {penalty > 0 ? ` (-${penalty})` : ""}
                            </div>
                            <button
                              onClick={() => removeFromSlot(slotName)}
                              className="mt-1 text-xs font-bold text-red-200 transition hover:text-red-400"
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setActiveSlot(slotName)}
                            className="flex h-[170px] w-[120px] items-center justify-center rounded-2xl border-2 border-cyan-300/60 bg-black/10 text-5xl font-light text-white/85 shadow-[0_0_24px_rgba(0,255,255,0.14)] transition hover:scale-105 hover:bg-black/15"
                          >
                            +
                          </button>

                          <div className="mt-2 text-center">
                            <div className="text-sm font-black text-white">{point.label}</div>
                            <div className="text-xs text-slate-200">Empty</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <aside className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">
              {activeSlot ? `Choose Player for ${layout[activeSlot]?.label ?? activeSlot}` : "Inventory"}
            </h2>
            <p className="mt-2 text-slate-300">
              {activeSlot
                ? "Click a player to place them in the selected slot."
                : "Click a slot on the pitch to assign a player."}
            </p>

            {activeSlot && (
              <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-300/10 p-4 text-sm text-slate-200">
                Current slot: <span className="font-bold">{normalizeSlotToPosition(activeSlot)}</span>
              </div>
            )}

            <div className="mt-6 max-h-[980px] space-y-3 overflow-y-auto pr-1">
              {inventory.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                  No players in inventory.
                </div>
              )}

              {inventory.map((player) => {
                const ownerSlot = findPlayerOwnerSlotByName(slots, inventory, player.name)
                const isUsedElsewhere = ownerSlot !== null && ownerSlot !== activeSlot
                const isSelectable = Boolean(activeSlot) && !isUsedElsewhere
                const previewPenalty = activeSlot ? getPositionPenalty(player, activeSlot) : 0
                const previewOvr = activeSlot ? getAdjustedRating(player, activeSlot) : player.rating

                return (
                  <button
                    key={player.id}
                    disabled={!isSelectable}
                    onClick={() => assignPlayerToSlot(player.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      isUsedElsewhere
                        ? "cursor-not-allowed border-white/5 bg-white/5 opacity-50"
                        : isSelectable
                        ? "border-cyan-300/40 bg-cyan-300/10 hover:scale-[1.01]"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <Image
                      src={player.cardImage}
                      alt={player.name}
                      width={64}
                      height={90}
                      className="rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black">{player.name}</div>
                      <div className="text-sm text-slate-300">
                        {player.rating} • {player.position}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-slate-400">
                        {player.rarity}
                      </div>
                      {(player.altPositions ?? []).length > 0 && (
                        <div className="mt-1 text-xs text-slate-300">
                          Alts: {player.altPositions?.join(", ")}
                        </div>
                      )}
                      {activeSlot && (
                        <div className="mt-1 text-xs text-slate-200">
                          In this slot: {previewOvr}
                          {previewPenalty > 0 ? ` (-${previewPenalty})` : ""}
                        </div>
                      )}
                    </div>

                    {isUsedElsewhere ? (
                      <span className="text-xs font-bold text-red-200">In Squad</span>
                    ) : activeSlot ? (
                      <span className="text-xs font-bold text-cyan-300">Use</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}