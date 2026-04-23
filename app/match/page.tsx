"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  getInventory,
  getSquad,
  getUserData,
  saveUserData,
  type InventoryPlayer,
} from "@/lib/storage"

type MatchOption = {
  id: string
  name: string
  opponentOvr: number
  rewardCoins: number
  description: string
}

type SimResult = {
  opponentName: string
  userGoals: number
  aiGoals: number
  didWin: boolean
  winRate: number
  loseRate: number
  reward: number
}

const MATCHES: MatchOption[] = [
  {
    id: "starter",
    name: "Starter Clash",
    opponentOvr: 85,
    rewardCoins: 10000,
    description: "Lower-level team. Safe way to earn coins.",
  },
  {
    id: "pro",
    name: "Pro Challenge",
    opponentOvr: 90,
    rewardCoins: 25000,
    description: "Balanced opponent with stronger players.",
  },
  {
    id: "elite",
    name: "Elite Showdown",
    opponentOvr: 99,
    rewardCoins: 50000,
    description: "Top-tier opponent. High risk, high reward.",
  },
]

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
  const pos = position.toUpperCase()

  if (pos === "GK") return "gk"
  if (["LB", "RB", "CB"].includes(pos)) return "defense"
  if (["CM", "CDM", "CAM"].includes(pos)) return "midfield"
  return "attack"
}

function isAltPosition(player: InventoryPlayer, slotName: string) {
  const slotPos = normalizeSlotToPosition(slotName)
  return (player.altPositions ?? []).map((p) => p.toUpperCase()).includes(slotPos)
}

function getPenalty(player: InventoryPlayer, slotName: string) {
  const playerPos = player.position.toUpperCase()
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
  ) return 6

  if (
    (playerGroup === "attack" && slotGroup === "defense") ||
    (playerGroup === "defense" && slotGroup === "attack")
  ) return 10

  if (
    (playerGroup === "midfield" && slotGroup === "defense") ||
    (playerGroup === "defense" && slotGroup === "midfield")
  ) return 6

  return 6
}

function getAdjustedRating(player: InventoryPlayer, slotName: string) {
  return Math.max(1, player.rating - getPenalty(player, slotName))
}

function getSquadPlayersWithSlots(): Array<{ player: InventoryPlayer; slot: string }> {
  const inventory = getInventory()
  const squad = getSquad()

  return Object.entries(squad.slots)
    .map(([slot, id]) => {
      const player = inventory.find((p) => p.id === id)
      if (!player) return null
      return { player, slot }
    })
    .filter((entry): entry is { player: InventoryPlayer; slot: string } => Boolean(entry))
}

function calculateAdjustedSquadOvr(
  playersWithSlots: Array<{ player: InventoryPlayer; slot: string }>,
  totalSlots: number
) {
  if (totalSlots === 0) return 0

  const total = playersWithSlots.reduce((sum, entry) => {
    return sum + getAdjustedRating(entry.player, entry.slot)
  }, 0)

  return Math.round(total / totalSlots)
}

function getMatchRates(userOvr: number, opponentOvr: number) {
  const diff = userOvr - opponentOvr

  let winRate = 50
  let loseRate = 50

  if (diff > 0) {
    winRate += diff * 10
    loseRate -= diff * 10
  } else if (diff < 0) {
    loseRate += Math.abs(diff) * 10
    winRate -= Math.abs(diff) * 10
  }

  winRate = Math.max(0, Math.min(100, winRate))
  loseRate = Math.max(0, Math.min(100, loseRate))

  return { winRate, loseRate }
}

function randomWinningScore() {
  const scores = [
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 1],
  ]
  return scores[Math.floor(Math.random() * scores.length)]
}

function randomLosingScore() {
  const scores = [
    [0, 1],
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 3],
    [2, 3],
    [1, 4],
  ]
  return scores[Math.floor(Math.random() * scores.length)]
}

function simulateMatch(userOvr: number, opponent: MatchOption): SimResult {
  const { winRate, loseRate } = getMatchRates(userOvr, opponent.opponentOvr)
  const roll = Math.random() * 100
  const didWin = roll < winRate

  const pickedScore = didWin ? randomWinningScore() : randomLosingScore()

  return {
    opponentName: opponent.name,
    userGoals: pickedScore[0],
    aiGoals: pickedScore[1],
    didWin,
    winRate,
    loseRate,
    reward: didWin ? opponent.rewardCoins : 0,
  }
}

export default function MatchPage() {
  const [coins, setCoins] = useState(0)
  const [result, setResult] = useState<SimResult | null>(null)

  const [selectedMatch, setSelectedMatch] = useState<MatchOption | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const squad = useMemo(() => getSquad(), [])
  const totalSlots = Object.keys(squad.slots || {}).length || 11
  const squadPlayersWithSlots = useMemo(() => getSquadPlayersWithSlots(), [])
  const squadCount = squadPlayersWithSlots.length

  const squadOvr = useMemo(() => {
    return calculateAdjustedSquadOvr(squadPlayersWithSlots, totalSlots)
  }, [squadPlayersWithSlots, totalSlots])

  useEffect(() => {
    setCoins(getUserData().coins)
  }, [])

  useEffect(() => {
    if (!isSimulating) return
    if (countdown <= 0) return

    const timer = window.setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [isSimulating, countdown])

  useEffect(() => {
    if (!isSimulating || countdown > 0 || !selectedMatch) return

    const sim = simulateMatch(squadOvr, selectedMatch)

    if (sim.didWin) {
      const user = getUserData()
      const updated = {
        ...user,
        coins: user.coins + sim.reward,
      }
      saveUserData(updated)
      setCoins(updated.coins)
    }

    setResult(sim)
    setIsSimulating(false)
    setCountdown(5)
  }, [isSimulating, countdown, selectedMatch, squadOvr])

  function openMatchPopup(match: MatchOption) {
    if (squadCount === 0) return
    setSelectedMatch(match)
    setShowPopup(true)
    setIsSimulating(false)
    setCountdown(5)
    setResult(null)
  }

  function closePopup() {
    if (isSimulating) return
    setShowPopup(false)
    setSelectedMatch(null)
    setCountdown(5)
    setResult(null)
  }

  function confirmPlayMatch() {
    if (!selectedMatch) return
    setResult(null)
    setIsSimulating(true)
    setCountdown(5)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_20%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Match</p>
            <h1 className="text-3xl font-black">Sim Match</h1>
            <p className="mt-1 text-slate-300">
              Pick a match and simulate it based on your squad OVR.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-400">Coins</div>
              <div className="text-2xl font-black">{coins}</div>
            </div>

            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
            >
              Main Menu
            </Link>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Your Team</h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase tracking-widest text-slate-400">Squad OVR</div>
                <div className="mt-2 text-4xl font-black">{squadOvr}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase tracking-widest text-slate-400">Players in Squad</div>
                <div className="mt-2 text-4xl font-black">{squadCount}</div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
              Win/Lose rates start at <span className="font-bold">50% / 50%</span>.
              <br />
              Every <span className="font-bold">1 OVR higher</span> gives
              <span className="font-bold"> +10% win</span>.
              <br />
              Every <span className="font-bold">1 OVR lower</span> gives
              <span className="font-bold"> +10% lose</span>.
              <br />
              Empty slots count as 0 OVR.
              <br />
              Alternative positions have no penalty.
              <br />
              No draws.
            </div>

            {squadCount === 0 && (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200">
                Your squad is empty. Add players to your squad first.
              </div>
            )}
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Match Selection</h2>

            <div className="mt-6 space-y-4">
              {MATCHES.map((match) => {
                const rates = getMatchRates(squadOvr, match.opponentOvr)

                return (
                  <div
                    key={match.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xl font-black">{match.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{match.description}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-slate-400">Opponent OVR</div>
                        <div className="text-2xl font-black">{match.opponentOvr}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs uppercase text-slate-400">Win</div>
                        <div className="text-xl font-black text-green-400">{rates.winRate}%</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs uppercase text-slate-400">Lose</div>
                        <div className="text-xl font-black text-red-400">{rates.loseRate}%</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs uppercase text-slate-400">Reward</div>
                        <div className="text-xl font-black text-yellow-300">{match.rewardCoins}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => openMatchPopup(match)}
                      disabled={squadCount === 0}
                      className="mt-5 w-full rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Play Match
                    </button>
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      </div>

      {showPopup && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-950 p-6 text-center shadow-2xl">
            {!isSimulating && !result && (
              <>
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Confirm Match</p>
                <h2 className="mt-3 text-3xl font-black">{selectedMatch.name}</h2>
                <p className="mt-3 text-slate-300">{selectedMatch.description}</p>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-slate-400">Your OVR</div>
                    <div className="mt-2 text-3xl font-black">{squadOvr}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-slate-400">Opponent</div>
                    <div className="mt-2 text-3xl font-black">{selectedMatch.opponentOvr}</div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={closePopup}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPlayMatch}
                    className="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950"
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}

            {isSimulating && (
              <>
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Match In Progress</p>
                <h2 className="mt-3 text-3xl font-black">{selectedMatch.name}</h2>

                <div className="mx-auto mt-8 h-20 w-20 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />

                <p className="mt-6 text-lg font-bold">Simulating match...</p>
                <p className="mt-2 text-slate-300">{countdown}s remaining</p>
              </>
            )}

            {!isSimulating && result && (
              <>
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Result</p>
                <h2 className="mt-3 text-3xl font-black">{result.opponentName}</h2>

                <div className="mt-6 text-6xl font-black">
                  {result.userGoals} - {result.aiGoals}
                </div>

                <div
                  className={`mt-4 text-2xl font-black ${
                    result.didWin ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {result.didWin ? "YOU WON" : "YOU LOST"}
                </div>

                <div className="mt-4 text-slate-300">
                  Win Rate: {result.winRate}% • Lose Rate: {result.loseRate}%
                </div>

                <div className="mt-3 text-xl font-bold text-yellow-300">
                  {result.didWin ? `+${result.reward} coins` : "+0 coins"}
                </div>

                <button
                  onClick={closePopup}
                  className="mt-6 w-full rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}