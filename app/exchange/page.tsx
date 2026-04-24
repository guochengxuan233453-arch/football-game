"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  getInventory,
  saveInventory,
  getSquad,
  type InventoryPlayer,
} from "@/lib/storage"

type RevealStage = "idle" | "tunnel" | "flag" | "position" | "club" | "card"

type ExchangeRequirement = {
  rating: number
  count: number
}

type ExchangeRecipe = {
  id: string
  name: string
  rewardOvr: number
  description: string
  requirements: ExchangeRequirement[]
  rewards: Omit<InventoryPlayer, "id">[]
}

const exchangeRecipes: ExchangeRecipe[] = [
  {
    id: "exchange_99_midfield",
    name: "Exchange 99 Zinedine Zidane",
    rewardOvr: 99,
    description: "Trade 10 x 97 players and 12 x 96 player for a 99 midfielder.",
    requirements: [
      { rating: 97, count: 10 },
      { rating: 96, count: 12 },
    ],
    rewards: [
      {
        baseId: "zidane_99",
        name: "Zidane",
        rating: 99,
        position: "CAM",
        nationFlag: "/flags/france.svg",
        clubLogo: "/clubs/icon.png",
        cardImage: "/cards/zidane99.png",
        rarity: "icon",
        walkoutType: "big",
        stats: {
          pace: 88,
          shooting: 96,
          passing: 99,
          dribbling: 99,
          defending: 78,
          physical: 88,
        },
        inPacks: false,
      },
    ],
  },
  {
    id: "exchange_99_attack",
    name: "Exchange 99 Cristiano Ronaldo",
    rewardOvr: 99,
    description: "Trade 9 x 97 players and 13 x 96 player for a 99 attacker.",
    requirements: [
      { rating: 97, count: 9 },
      { rating: 96, count: 13 },
    ],
    rewards: [
      {
        baseId: "cristiano_99",
        name: "Cristiano Ronaldo",
        rating: 99,
        position: "LW",
        nationFlag: "/flags/portugal.svg",
        clubLogo: "/clubs/al_nassr.svg",
        cardImage: "/cards/cristiano99.png",
        rarity: "icon",
        walkoutType: "big",
        stats: {
          pace: 98,
          shooting: 99,
          passing: 95,
          dribbling: 99,
          defending: 60,
          physical: 90,
        },
        inPacks: false,
      },
    ],
  },
  {
    id: "exchange_99_winger",
    name: "Exchange 99 Lionel Messi",
    rewardOvr: 99,
    description: "Trade 11 x 97 players and 11 x 96 player for a 99 winger.",
    requirements: [
      { rating: 97, count: 11 },
      { rating: 96, count: 11 },
    ],
    rewards: [
      {
        baseId: "messi_99",
        name: "Messi",
        rating: 99,
        position: "RW",
        nationFlag: "/flags/argentina.svg",
        clubLogo: "/clubs/inter_miami.svg",
        cardImage: "/cards/messi99.png",
        rarity: "icon",
        walkoutType: "big",
        stats: {
          pace: 96,
          shooting: 98,
          passing: 99,
          dribbling: 99,
          defending: 45,
          physical: 82,
        },
        inPacks: false,
      },
    ],
  },
  {
    id: "exchange_98_creator",
    name: "Exchange 98 Maldini",
    rewardOvr: 98,
    description: "Trade 2 x 97 player and 5 x 96 player for a 98 creator.",
    requirements: [
      { rating: 97, count: 2 },
      { rating: 96, count: 5 },
    ],
    rewards: [
      {
        baseId: "maldini_98",
        name: "Maldini",
        rating: 98,
        position: "CB",
        nationFlag: "/flags/italy.svg",
        clubLogo: "/clubs/icon.png",
        cardImage: "/cards/maldini98.png",
        rarity: "icon",
        walkoutType: "big",
        stats: {
          pace: 88,
          shooting: 96,
          passing: 99,
          dribbling: 95,
          defending: 78,
          physical: 88,
        },
        inPacks: false,
      },
    ],
  },
  {
    id: "exchange_98_forward",
    name: "Exchange 98 Johan Cruyff",
    rewardOvr: 98,
    description: "Trade 3 x 97 player and 3 x 96 player for a 98 forward.",
    requirements: [
      { rating: 97, count: 3 },
      { rating: 96, count: 3 },
    ],
    rewards: [
      {
        baseId: "cruyff_98",
        name: "Cruyff",
        rating: 98,
        position: "ST",
        nationFlag: "/flags/netherlands.png",
        clubLogo: "/clubs/icon.png",
        cardImage: "/cards/cruyff98.png",
        rarity: "icon",
        walkoutType: "big",
        stats: {
          pace: 95,
          shooting: 97,
          passing: 91,
          dribbling: 99,
          defending: 38,
          physical: 80,
        },
        inPacks: false,
      },
    ],
  },
]

function randomReward(rewards: Omit<InventoryPlayer, "id">[]) {
  return rewards[Math.floor(Math.random() * rewards.length)]
}

function getRequirementSummary(requirements: ExchangeRequirement[]) {
  return requirements.map((req) => `${req.count} x ${req.rating}`).join(" + ")
}

function getSquadIds() {
  const squad = getSquad()
  return new Set(Object.values(squad.slots).filter(Boolean) as string[])
}

export default function ExchangePage() {
  const [inventory, setInventory] = useState<InventoryPlayer[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [reward, setReward] = useState<InventoryPlayer | null>(null)
  const [stage, setStage] = useState<RevealStage>("idle")
  const [selectedExchangeId, setSelectedExchangeId] = useState(exchangeRecipes[0].id)

  useEffect(() => {
    setInventory(getInventory())
  }, [])

  const squadIds = useMemo(() => getSquadIds(), [inventory])

  const selectedExchange =
    exchangeRecipes.find((exchange) => exchange.id === selectedExchangeId) ??
    exchangeRecipes[0]

  const selectedPlayers = useMemo(
    () => inventory.filter((p) => selectedIds.includes(p.id)),
    [inventory, selectedIds]
  )

  const requiredRatings = useMemo(
    () => [...new Set(selectedExchange.requirements.map((req) => req.rating))],
    [selectedExchange]
  )

  const eligiblePlayers = useMemo(
    () =>
      inventory.filter(
        (p) => requiredRatings.includes(p.rating) && !squadIds.has(p.id)
      ),
    [inventory, requiredRatings, squadIds]
  )

  const totalRequired = useMemo(
    () => selectedExchange.requirements.reduce((sum, req) => sum + req.count, 0),
    [selectedExchange]
  )

  const requirementCounts = useMemo(() => {
    const counts: Record<number, number> = {}

    for (const req of selectedExchange.requirements) {
      counts[req.rating] = selectedPlayers.filter((p) => p.rating === req.rating).length
    }

    return counts
  }, [selectedExchange, selectedPlayers])

  const canExchange = useMemo(() => {
    if (selectedPlayers.length !== totalRequired) return false

    for (const req of selectedExchange.requirements) {
      const count = selectedPlayers.filter((p) => p.rating === req.rating).length
      if (count !== req.count) return false
    }

    return true
  }, [selectedPlayers, selectedExchange, totalRequired])

  const revealActive =
    stage === "tunnel" ||
    stage === "flag" ||
    stage === "position" ||
    stage === "club" ||
    stage === "card"

  function changeExchange(exchangeId: string) {
    setSelectedExchangeId(exchangeId)
    setSelectedIds([])
    setMessage("")
    setReward(null)
    setStage("idle")
  }

  function togglePlayer(id: string) {
    setMessage("")
    setReward(null)

    if (squadIds.has(id)) {
      setMessage("You cannot use players that are in your squad.")
      return
    }

    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)

      const player = inventory.find((p) => p.id === id)
      if (!player) return prev

      const req = selectedExchange.requirements.find((r) => r.rating === player.rating)
      if (!req) return prev

      const alreadyForRating = prev
        .map((pid) => inventory.find((p) => p.id === pid))
        .filter((p): p is InventoryPlayer => Boolean(p))
        .filter((p) => p.rating === player.rating).length

      if (alreadyForRating >= req.count) return prev
      if (prev.length >= totalRequired) return prev

      return [...prev, id]
    })
  }

  function autoAddPlayers() {
    setMessage("")
    setReward(null)

    const chosen: string[] = []

    for (const req of selectedExchange.requirements) {
      const playersForReq = eligiblePlayers
        .filter((p) => p.rating === req.rating && !chosen.includes(p.id))
        .slice(0, req.count)

      chosen.push(...playersForReq.map((p) => p.id))
    }

    setSelectedIds(chosen)

    const missing = selectedExchange.requirements
      .map((req) => {
        const count = chosen
          .map((id) => inventory.find((p) => p.id === id))
          .filter((p): p is InventoryPlayer => Boolean(p))
          .filter((p) => p.rating === req.rating).length

        return count < req.count ? `${req.count - count} more ${req.rating}` : null
      })
      .filter(Boolean)

    if (missing.length > 0) {
      setMessage(`Auto Add incomplete. Missing: ${missing.join(", ")}.`)
    } else {
      setMessage("Auto Add complete.")
    }
  }

  function startReveal() {
    setStage("tunnel")
    setTimeout(() => setStage("flag"), 1700)
    setTimeout(() => setStage("position"), 2900)
    setTimeout(() => setStage("club"), 4100)
    setTimeout(() => setStage("card"), 5400)
  }

  function resetReveal() {
    setStage("idle")
    setReward(null)
  }

  function doExchange() {
    if (!canExchange) {
      setMessage(`You need exactly ${getRequirementSummary(selectedExchange.requirements)}.`)
      return
    }

    if (selectedIds.some((id) => squadIds.has(id))) {
      setMessage("You cannot use players that are in your squad.")
      return
    }

    const currentInventory = getInventory()
    const remaining = currentInventory.filter((p) => !selectedIds.includes(p.id))

    const baseReward = randomReward(selectedExchange.rewards)
    const newReward: InventoryPlayer = {
      ...baseReward,
      id: `${baseReward.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    }

    remaining.push(newReward)
    saveInventory(remaining)

    setInventory(remaining)
    setSelectedIds([])
    setReward(newReward)
    setMessage(`Exchange complete. You received ${newReward.name}!`)
    startReveal()
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_25%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Exchange</p>
            <h1 className="text-3xl font-black">Player Exchanges</h1>
            <p className="mt-1 text-slate-300">
              Auto add fodder, protect squad players, and reveal rewards.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
          >
            Main Menu
          </Link>
        </header>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {exchangeRecipes.map((exchange) => (
            <button
              key={exchange.id}
              onClick={() => changeExchange(exchange.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedExchangeId === exchange.id
                  ? "border-cyan-300 bg-cyan-300/10"
                  : "border-white/10 bg-black/20 hover:bg-white/10"
              }`}
            >
              <div className="font-black">{exchange.name}</div>
              <div className="mt-1 text-sm text-slate-300">{exchange.rewardOvr} OVR Reward</div>
              <div className="mt-2 text-xs text-slate-400">
                {getRequirementSummary(exchange.requirements)}
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Eligible Players</h2>
                <p className="mt-2 text-slate-400">
                  Squad players are locked and cannot be used.
                </p>
              </div>

              <button
                onClick={autoAddPlayers}
                className="rounded-2xl border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 font-black text-cyan-200 transition hover:bg-cyan-300/20"
              >
                Auto Add
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {eligiblePlayers.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                  You do not have any usable players that fit this exchange.
                </div>
              )}

              {eligiblePlayers.map((player) => {
                const selected = selectedIds.includes(player.id)

                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-cyan-300 bg-cyan-300/10"
                        : "border-white/10 bg-black/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={player.cardImage}
                        alt={player.name}
                        width={68}
                        height={96}
                        className="rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-black">{player.name}</div>
                        <div className="text-sm text-slate-300">
                          {player.rating} • {player.position}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">{selectedExchange.name}</h2>
            <p className="mt-2 text-slate-300">{selectedExchange.description}</p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              Requirements:
              <br />
              <span className="font-bold">{getRequirementSummary(selectedExchange.requirements)}</span>
            </div>

            <div className="mt-6 space-y-3">
              {selectedPlayers.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                  Select the required players or use Auto Add.
                </div>
              )}

              {selectedPlayers.map((player) => (
                <div key={player.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="font-black">{player.name}</div>
                  <div className="text-sm text-slate-300">
                    {player.rating} • {player.position}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              {selectedExchange.requirements.map((req) => (
                <div key={req.rating}>
                  {req.rating} selected: {requirementCounts[req.rating] ?? 0} / {req.count}
                </div>
              ))}
            </div>

            <button
              onClick={doExchange}
              disabled={!canExchange}
              className="mt-6 w-full rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exchange for {selectedExchange.rewardOvr} Player
            </button>

            {message && <p className="mt-4 text-slate-300">{message}</p>}
          </aside>
        </div>
      </div>

      {revealActive && reward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-4">
          <div className="relative h-[640px] w-full max-w-6xl overflow-hidden rounded-[28px]">
            <div className="absolute inset-0 scale-110 animate-[tunnelPush_5.6s_linear_forwards]">
              <Image
                src="/backgrounds/tunnel.jpg"
                alt="Tunnel background"
                fill
                priority
                className="object-cover"
              />
            </div>

            <div className="absolute inset-0 bg-black/30" />

            {stage === "tunnel" && (
              <div className="absolute inset-0 flex items-end justify-center pb-10">
                <div className="rounded-full border border-white/15 bg-black/35 px-6 py-3 text-sm uppercase tracking-[0.45em] text-white/80 backdrop-blur">
                  Walkout...
                </div>
              </div>
            )}

            {stage === "flag" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
                  <Image
                    src={reward.nationFlag}
                    alt="Nation flag"
                    width={220}
                    height={140}
                    className="rounded-xl object-contain"
                  />
                </div>
              </div>
            )}

            {stage === "position" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl border border-white/10 bg-black/30 px-16 py-10 text-center shadow-2xl backdrop-blur">
                  <div className="text-8xl font-black tracking-wider text-white">
                    {reward.position}
                  </div>
                </div>
              </div>
            )}

            {stage === "club" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur">
                  <Image
                    src={reward.clubLogo}
                    alt="Club badge"
                    width={180}
                    height={180}
                    className="object-contain"
                  />
                </div>
              </div>
            )}

            {stage === "card" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Image
                  src={reward.cardImage}
                  alt={reward.name}
                  width={340}
                  height={500}
                  priority
                  className="rounded-[28px] shadow-[0_0_70px_rgba(255,255,255,0.22)]"
                />

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={resetReveal}
                    className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes tunnelPush {
          0% {
            transform: scale(1.1) translateY(0px);
          }
          100% {
            transform: scale(1.24) translateY(-12px);
          }
        }
      `}</style>
    </main>
  )
}