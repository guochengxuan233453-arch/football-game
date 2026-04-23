"use client"

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
    costCoins: 1000000,
    required97: 2,
    required96: 3,
    reward: {
      baseId: "gullit_evo_99",
      name: "Gullit",
      rating: 99,
      position: "CM",
      nationFlag: "/flags/netherlands.png",
      clubLogo: "/clubs/icon.png",
      cardImage: "/cards/gullit_99.png",
      rarity: "icon",
      walkoutType: "big",
      inPacks: false,
      stats: {
        pace: 99,
        shooting: 99,
        passing: 93,
        dribbling: 98,
        defending: 45,
        physical: 96,
      },
    },
  },
  {
  id: "r9_evo",
  basePlayerBaseId: "r9_92", // CHANGE if your base R9 id is different
  basePlayerName: "Ronaldo",
  baseCardImage: "/cards/r9_92.png", // change if needed
  costCoins: 10000000,
  required97: 20,
  required96: 30,
  reward: {
    baseId: "r9_100",
    name: "Ronaldo Nazário",
    rating: 100,
    position: "ST",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/r9_100.png", // add this image
    rarity: "icon",
    walkoutType: "big",
    inPacks: false, // IMPORTANT → cannot be packed
    stats: {
      pace: 99,
      shooting: 99,
      passing: 92,
      dribbling: 99,
      defending: 45,
      physical: 95,
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

  useEffect(() => {
    setInventory(getInventory())
    setCoins(getUserData().coins)
  }, [])

  const selectedRecipe =
    evoRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? evoRecipes[0]

  const basePlayer = useMemo(() => {
    return inventory.find((p) => p.baseId === selectedRecipe.basePlayerBaseId) ?? null
  }, [inventory, selectedRecipe])

  const eligibleFodder = useMemo(() => {
    return inventory.filter(
      (p) =>
        p.id !== basePlayer?.id &&
        (p.rating === 97 || p.rating === 96)
    )
  }, [inventory, basePlayer])

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
  }

  function toggleFodder(playerId: string) {
    setMessage("")
    setReward(null)

    setSelectedFodderIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId)
      }

      const max = selectedRecipe.required97 + selectedRecipe.required96
      if (prev.length >= max) return prev

      return [...prev, playerId]
    })
  }

  function doEvo() {
    if (!basePlayer) {
      setMessage(`You need ${selectedRecipe.basePlayerName} in your inventory.`)
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
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_25%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-purple-300">EVO</p>
            <h1 className="text-3xl font-black">Player Evolution</h1>
            <p className="mt-1 text-slate-300">
              Upgrade a specific player into a 99 EVO card.
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
              Evolve to 99
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
    </main>
  )
}