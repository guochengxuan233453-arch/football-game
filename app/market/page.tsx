"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  addMarketListing,
  getInventory,
  getMarketListings,
  getUserData,
  removeMarketListing,
  removePlayerFromInventory,
  saveInventory,
  saveUserData,
  type InventoryPlayer,
  type MarketListing,
} from "@/lib/storage"
import {
  getMarketBuyPrice,
  getQuickSellPrice,
  getSuggestedSellPrice,
  refreshAiMarket,
} from "@/lib/market"

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function getDisplayStats(player: InventoryPlayer) {
  if (player.stats) return player.stats

  const base = player.rating
  return {
    pace: Math.min(99, base + 2),
    shooting: Math.min(99, base),
    passing: Math.min(99, base - 1),
    dribbling: Math.min(99, base + 1),
    defending: Math.max(35, base - 8),
    physical: Math.max(40, base - 3),
  }
}

export default function MarketPage() {
  const [inventory, setInventory] = useState<InventoryPlayer[]>([])
  const [market, setMarket] = useState<MarketListing[]>([])
  const [coins, setCoins] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<InventoryPlayer | null>(null)
  const [now, setNow] = useState(Date.now())
  const [mounted, setMounted] = useState(false)

  function refreshAll() {
    const refreshed = refreshAiMarket()
    const inv = getInventory()

    setInventory(inv)
    setMarket(refreshed)
    setCoins(getUserData().coins)

    setSelectedPlayer((prev) => {
      if (!prev) return inv[0] ?? null
      return inv.find((p) => p.id === prev.id) ?? inv[0] ?? null
    })
  }

  useEffect(() => {
    setMounted(true)
    refreshAll()

    const interval = window.setInterval(() => {
      setNow(Date.now())
      refreshAll()
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  function quickSell(player: InventoryPlayer) {
    const value = getQuickSellPrice(player)
    const user = getUserData()

    saveUserData({
      ...user,
      coins: user.coins + value,
    })

    removePlayerFromInventory(player.id)
    refreshAll()
  }

  function listOnMarket(player: InventoryPlayer) {
    const price = getSuggestedSellPrice(player)
    const listedAt = Date.now()

    const expiresAt =
      player.rarity === "gold"
        ? listedAt + 15_000
        : player.rarity === "elite"
        ? listedAt + 60_000
        : listedAt + 300_000

    addMarketListing({
      listingId: `${player.id}-listing`,
      player,
      price,
      listedAt,
      expiresAt,
      sellerType: "user",
    })

    removePlayerFromInventory(player.id)
    refreshAll()
  }

  function buyFromMarket(listingId: string) {
    const listing = getMarketListings().find((l) => l.listingId === listingId)
    if (!listing) return

    const user = getUserData()

    if (user.coins < listing.price) {
      alert("Not enough coins.")
      return
    }

    saveUserData({
      ...user,
      coins: user.coins - listing.price,
    })

    const currentInventory = getInventory()
    currentInventory.push(listing.player)
    saveInventory(currentInventory)

    removeMarketListing(listingId)
    refreshAll()
  }

  const stats = selectedPlayer ? getDisplayStats(selectedPlayer) : null

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.10),transparent_20%),linear-gradient(to_bottom,#020617,#000000)] text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            Loading market...
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.10),transparent_20%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">
              Transfer Market
            </p>
            <h1 className="text-3xl font-black">Buy and Sell Cards</h1>
            <p className="mt-1 text-slate-300">
              AI listings expire automatically by rarity.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-400">
                Coins
              </div>
              <div className="text-2xl font-black">{coins}</div>
            </div>

            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10"
            >
              Main Menu
            </Link>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr_0.8fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Your Inventory</h2>

            <div className="mt-6 space-y-3">
              {inventory.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                  No cards to sell.
                </div>
              )}

              {inventory.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between gap-4 rounded-2xl border p-3 ${
                    selectedPlayer?.id === player.id
                      ? "border-cyan-300 bg-cyan-300/10"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <button
                    onClick={() => setSelectedPlayer(player)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <Image
                      src={player.cardImage}
                      alt={player.name}
                      width={60}
                      height={84}
                      className="rounded-lg"
                    />
                    <div>
                      <div className="font-bold">{player.name}</div>
                      <div className="text-sm text-slate-400">
                        {player.position} • {player.rating}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Quick sell: {getQuickSellPrice(player)} • Market: {getMarketBuyPrice(player)}
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => quickSell(player)}
                      className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200"
                    >
                      Quick Sell
                    </button>
                    <button
                      onClick={() => listOnMarket(player)}
                      className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
                    >
                      List
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Market Listings</h2>

            <div className="mt-6 space-y-3">
              {market.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                  No listings yet.
                </div>
              )}

              {market.map((listing) => (
                <div
                  key={listing.listingId}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={listing.player.cardImage}
                      alt={listing.player.name}
                      width={60}
                      height={84}
                      className="rounded-lg"
                    />
                    <div>
                      <div className="font-bold">{listing.player.name}</div>
                      <div className="text-sm text-slate-400">
                        {listing.player.position} • {listing.player.rating}
                      </div>
                      <div className="mt-1 text-sm text-cyan-300">
                        {listing.price} coins
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {listing.sellerType === "ai" ? "AI Listing" : "Your Listing"} •{" "}
                        {formatTime(listing.expiresAt - now)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => buyFromMarket(listing.listingId)}
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
                  >
                    Buy
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Player Stats</h2>

            {!selectedPlayer && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-400">
                Click a player in your inventory to see stats.
              </div>
            )}

            {selectedPlayer && stats && (
              <div className="mt-6">
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <Image
                    src={selectedPlayer.cardImage}
                    alt={selectedPlayer.name}
                    width={84}
                    height={118}
                    className="rounded-xl"
                  />
                  <div>
                    <div className="text-xl font-black">{selectedPlayer.name}</div>
                    <div className="text-slate-400">
                      {selectedPlayer.position} • {selectedPlayer.rating}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {selectedPlayer.rarity.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ["PAC", stats.pace],
                    ["SHO", stats.shooting],
                    ["PAS", stats.passing],
                    ["DRI", stats.dribbling],
                    ["DEF", stats.defending],
                    ["PHY", stats.physical],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-bold">{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="h-3 rounded-full bg-white/10">
                        <div
                          className="h-3 rounded-full bg-cyan-400"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}