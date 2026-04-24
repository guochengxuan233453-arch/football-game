"use client"

import { getSquad } from "@/lib/storage"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  getInventory,
  getUserData,
  saveInventory,
  saveUserData,
  type InventoryPlayer,
} from "@/lib/storage"

function getSquadIds() {
  const squad = getSquad()
  return new Set(Object.values(squad.slots).filter(Boolean) as string[])
}

type EvoRecipe = {
  id: string
  basePlayerBaseId: string
  basePlayerName: string
  baseCardImage: string
  costCoins: number
  required97: number
  required96: number
  reward: Omit<InventoryPlayer, "id">
}

const evoRecipes: EvoRecipe[] = [
  {
    id: "gullit_evo",
    basePlayerBaseId: "gullit_95",
    basePlayerName: "Gullit",
    baseCardImage: "/cards/gullit_95.jpg",
    costCoins: 5000000,
    required97: 15,
    required96: 20,
    reward: {
      baseId: "gullit_evo_99",
      name: "Gullit",
      rating: 99,
      position: "CM",
      altPositions: ["CDM", "CAM", "CB", "LB", "RB", "RW", "LW"],
      nationFlag: "/flags/netherlands.png",
      clubLogo: "/clubs/icon.png",
      cardImage: "/cards/gullit_99.png",
      rarity: "icon",
      walkoutType: "big",
      inPacks: false,
      stats: {
        pace: 99,
        shooting: 96,
        passing: 99,
        dribbling: 98,
        defending: 92,
        physical: 96,
      },
    },
  },
  {
    id: "r9_evo",
    basePlayerBaseId: "r9_92",
    basePlayerName: "Ronaldo",
    baseCardImage: "/cards/r9_92.png",
    costCoins: 10000000,
    required97: 20,
    required96: 30,
    reward: {
      baseId: "r9_100",
      name: "Ronaldo",
      rating: 100,
      position: "ST",
      nationFlag: "/flags/brazil.svg",
      clubLogo: "/clubs/icon.png",
      cardImage: "/cards/r9_100.png",
      rarity: "icon",
      walkoutType: "big",
      inPacks: false,
      stats: {
        pace: 100,
        shooting: 100,
        passing: 84,
        dribbling: 100,
        defending: 45,
        physical: 89,
      },
    },
  },
]

export default function EvoPage() {
  const [inventory, setInventory] = useState<InventoryPlayer[]>([])
  const [coins, setCoins] = useState(0)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(evoRecipes[0].id)
  const [selectedFodderIds, setSelectedFodderIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [reward, setReward] = useState<InventoryPlayer | null>(null)
  const [revealStage, setRevealStage] = useState<
    "idle" | "tunnel" | "flag" | "position" | "club" | "card"
  >("idle")

  useEffect(() => {
    setInventory(getInventory())
    setCoins(getUserData().coins)
  }, [])

  const squadIds = useMemo(() => getSquadIds(), [inventory])

  const selectedRecipe =
    evoRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? evoRecipes[0]

  const basePlayer = useMemo(() => {
    return (
      inventory.find(
        (p) =>
          p.baseId === selectedRecipe.basePlayerBaseId &&
          !squadIds.has(p.id)
      ) ?? null
    )
  }, [inventory, selectedRecipe, squadIds])

  const eligibleFodder = useMemo(() => {
    return inventory.filter(
      (p) =>
        p.id !== basePlayer?.id &&
        !squadIds.has(p.id) &&
        (p.rating === 97 || p.rating === 96)
    )
  }, [inventory, basePlayer, squadIds])

  const selectedFodders = useMemo(() => {
    return inventory.filter((p) => selectedFodderIds.includes(p.id))
  }, [inventory, selectedFodderIds])

  const count97 = selectedFodders.filter((p) => p.rating === 97).length
  const count96 = selectedFodders.filter((p) => p.rating === 96).length

  const canEvo =
    !!basePlayer &&
    coins >= selectedRecipe.costCoins &&
    selectedFodders.length === selectedRecipe.required97 + selectedRecipe.required96 &&
    count97 === selectedRecipe.required97 &&
    count96 === selectedRecipe.required96

  function changeRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId)
    setSelectedFodderIds([])
    setMessage("")
    setReward(null)
    setRevealStage("idle")
  }

  function toggleFodder(playerId: string) {
    setMessage("")
    setReward(null)

    if (squadIds.has(playerId)) {
      setMessage("You cannot use players that are in your squad.")
      return
    }

    setSelectedFodderIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId)
      }

      const max = selectedRecipe.required97 + selectedRecipe.required96
      if (prev.length >= max) return prev

      return [...prev, playerId]
    })
  }

  function autoAddFodder() {
    setMessage("")
    setReward(null)

    const chosen97 = eligibleFodder
      .filter((p) => p.rating === 97)
      .slice(0, selectedRecipe.required97)

    const chosen96 = eligibleFodder
      .filter((p) => p.rating === 96)
      .slice(0, selectedRecipe.required96)

    const chosen = [...chosen97, ...chosen96]

    setSelectedFodderIds(chosen.map((p) => p.id))

    if (
      chosen97.length < selectedRecipe.required97 ||
      chosen96.length < selectedRecipe.required96
    ) {
      setMessage("Auto Add incomplete. You do not have enough usable players.")
    } else {
      setMessage("Auto Add complete.")
    }
  }

  function startReveal() {
    setRevealStage("tunnel")
    setTimeout(() => setRevealStage("flag"), 1700)
    setTimeout(() => setRevealStage("position"), 2900)
    setTimeout(() => setRevealStage("club"), 4100)
    setTimeout(() => setRevealStage("card"), 5400)
  }

  function doEvo() {
    if (!basePlayer) {
      setMessage(`You need ${selectedRecipe.basePlayerName} in your inventory.`)
      return
    }

    if (squadIds.has(basePlayer.id)) {
      setMessage("You cannot evolve a player that is in your squad.")
      return
    }

    if (selectedFodderIds.some((id) => squadIds.has(id))) {
      setMessage("You cannot use players that are in your squad.")
      return
    }

    if (coins < selectedRecipe.costCoins) {
      setMessage("Not enough coins.")
      return
    }

    if (!canEvo) {
      setMessage(
        `You need ${selectedRecipe.basePlayerName}, ${selectedRecipe.required97}x 97 OVR, ${selectedRecipe.required96}x 96 OVR, and ${selectedRecipe.costCoins.toLocaleString()} coins.`
      )
      return
    }

    const currentInventory = getInventory()
    const remaining = currentInventory.filter(
      (p) => p.id !== basePlayer.id && !selectedFodderIds.includes(p.id)
    )

    const newReward: InventoryPlayer = {
      ...selectedRecipe.reward,
      id: `${selectedRecipe.reward.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    }

    remaining.push(newReward)
    saveInventory(remaining)

    const user = getUserData()
    const updatedUser = {
      ...user,
      coins: user.coins - selectedRecipe.costCoins,
    }
    saveUserData(updatedUser)

    setInventory(remaining)
    setCoins(updatedUser.coins)
    setSelectedFodderIds([])
    setReward(newReward)
    setMessage(`Evolution complete. You received ${newReward.name}!`)
    startReveal()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_25%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-purple-300">EVO</p>
            <h1 className="text-3xl font-black">Player Evolution</h1>
            <p className="mt-1 text-slate-300">
              Upgrade a specific player into a 99/100 EVO card.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-400">Coins</div>
              <div className="text-2xl font-black">{coins.toLocaleString()}</div>
            </div>

            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10"
            >
              Main Menu
            </Link>
          </div>
        </header>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {evoRecipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => changeRecipe(recipe.id)}
              className={`rounded-2xl border p-5 text-left transition ${
                selectedRecipeId === recipe.id
                  ? "border-purple-300 bg-purple-300/10"
                  : "border-white/10 bg-black/20 hover:bg-white/10"
              }`}
            >
              <div className="text-lg font-black">{recipe.basePlayerName} EVO</div>
              <div className="mt-2 text-sm text-slate-300">
                {recipe.required97}x 97 • {recipe.required96}x 96 • {recipe.costCoins.toLocaleString()} coins
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Required Base Player</h2>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-4">
                <Image
                  src={selectedRecipe.baseCardImage}
                  alt={selectedRecipe.basePlayerName}
                  width={84}
                  height={118}
                  className="rounded-xl"
                />
                <div>
                  <div className="text-xl font-black">{selectedRecipe.basePlayerName}</div>
                  <div className="text-slate-300">
                    {basePlayer ? "Found in inventory" : "Not in inventory"}
                  </div>
                </div>
              </div>
            </div>

            <h2 className="mt-8 text-2xl font-black">Select Fodder Players</h2>
            <p className="mt-2 text-slate-400">
              Choose exactly {selectedRecipe.required97} x 97 OVR and {selectedRecipe.required96} x 96 OVR players.
            </p>

            <button
              onClick={autoAddFodder}
              className="mt-4 rounded-2xl border border-purple-300/40 bg-purple-300/10 px-5 py-3 font-black text-purple-200"
            >
              Auto Add
            </button>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {eligibleFodder.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                  No eligible fodder players found.
                </div>
              )}

              {eligibleFodder.map((player) => {
                const selected = selectedFodderIds.includes(player.id)

                return (
                  <button
                    key={player.id}
                    onClick={() => toggleFodder(player.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-purple-300 bg-purple-300/10"
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
            <h2 className="text-2xl font-black">Evolution Summary</h2>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <div>{selectedRecipe.basePlayerName}: {basePlayer ? "Ready" : "Missing"}</div>
              <div>97 selected: {count97} / {selectedRecipe.required97}</div>
              <div>96 selected: {count96} / {selectedRecipe.required96}</div>
              <div>Coins: {coins.toLocaleString()} / {selectedRecipe.costCoins.toLocaleString()}</div>
            </div>

            <button
              onClick={doEvo}
              disabled={!canEvo}
              className="mt-6 w-full rounded-2xl bg-purple-400 px-6 py-4 font-black text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Evolve
            </button>

            {message && <p className="mt-4 text-slate-300">{message}</p>}

            {reward && (
              <div className="mt-6 rounded-2xl border border-purple-300/30 bg-purple-300/10 p-4 text-center">
                <div className="mb-3 font-black">EVO Reward</div>
                <div className="flex justify-center">
                  <Image
                    src={reward.cardImage}
                    alt={reward.name}
                    width={120}
                    height={170}
                    className="rounded-xl"
                  />
                </div>
                <div className="mt-3 text-lg font-black">{reward.name}</div>
                <div className="text-slate-300">
                  {reward.rating} • {reward.position}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {revealStage !== "idle" && reward && (
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

            {revealStage === "tunnel" && (
              <div className="absolute inset-0 flex items-end justify-center pb-10">
                <div className="rounded-full border border-white/15 bg-black/35 px-6 py-3 text-sm uppercase tracking-[0.45em] text-white/80 backdrop-blur">
                  Walkout...
                </div>
              </div>
            )}

            {revealStage === "flag" && (
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

            {revealStage === "position" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl border border-white/10 bg-black/30 px-16 py-10 text-center shadow-2xl backdrop-blur">
                  <div className="text-8xl font-black tracking-wider text-white">
                    {reward.position}
                  </div>
                </div>
              </div>
            )}

            {revealStage === "club" && (
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

            {revealStage === "card" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Image
                  src={reward.cardImage}
                  alt={reward.name}
                  width={340}
                  height={500}
                  priority
                  className="rounded-[28px] shadow-[0_0_70px_rgba(255,255,255,0.22)]"
                />

                <button
                  onClick={() => setRevealStage("idle")}
                  className="mt-8 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Back
                </button>
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