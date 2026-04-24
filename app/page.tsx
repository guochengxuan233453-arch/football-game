"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getUserData, saveUserData } from "@/lib/storage"

export default function Home() {
  const [coins, setCoins] = useState(0)

  useEffect(() => {
    const user = getUserData()
    setCoins(user.coins)
  }, [])

  function giveCoins() {
    const user = getUserData()

    const updated = {
      ...user,
      coins: user.coins + 1000000,
    }

    saveUserData(updated)
    setCoins(updated.coins)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_25%),linear-gradient(to_bottom,#020617,#000000)] text-white">

      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* Top bar */}
        <div className="mb-10 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">
              Ultimate Team
            </p>
            <h1 className="text-4xl font-black">
              Football Pack Game
            </h1>
          </div>

          <div className="flex items-center gap-4">

            <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-3">
              <p className="text-xs uppercase text-slate-400">
                Coins
              </p>
              <p className="text-2xl font-black">
                {coins}
              </p>
            </div>

            
            

          </div>
        </div>

        {/* Main menu */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          <Link
            href="/packs"
            className="rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-6 hover:bg-cyan-300/20 transition"
          >
            <div className="text-4xl">🎴</div>
            <h2 className="mt-4 text-2xl font-black">Open Packs</h2>
            <p className="mt-2 text-slate-300">
              Buy packs and reveal players.
            </p>
          </Link>

          <Link
            href="/squad"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
          >
            <div className="text-4xl">🧩</div>
            <h2 className="mt-4 text-2xl font-black">Build Squad</h2>
            <p className="mt-2 text-slate-300">
              Build your team and formation.
            </p>
          </Link>

          <Link
            href="/match"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
          >
            <div className="text-4xl">⚽</div>
            <h2 className="mt-4 text-2xl font-black">Play Match</h2>
            <p className="mt-2 text-slate-300">
              Play matches to earn rewards.
            </p>
          </Link>

          <Link
            href="/market"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
          >
            <div className="text-4xl">💰</div>
            <h2 className="mt-4 text-2xl font-black">Transfer Market</h2>
            <p className="mt-2 text-slate-300">
              Buy and sell player cards.
            </p>
          </Link>
            <Link
              href="/exchange"
              className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
            >
              <div className="text-4xl">🔁</div>
              <h2 className="mt-4 text-2xl font-black">Exchange</h2>
              <p className="mt-2 text-slate-300">
                Trade 96 and 97 players for a 99 player.
              </p>
          </Link>

          <Link
              href="/evo"
              className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
            >
              <div className="text-4xl">🧬</div>
              <h2 className="mt-4 text-2xl font-black">Evo</h2>
              <p className="mt-2 text-slate-300">
                Upgrade specific players into stronger cards.
              </p>
            </Link>
          <Link
              href="/redeem"
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
            >
              <div className="text-4xl">🎟️</div>
              <h2 className="mt-4 text-2xl font-black">Redeem</h2>
              <p className="mt-2 text-slate-300">
                Enter a code for coins and players.
              </p>
            </Link>
          <Link
              href="/arcade"
              className="rounded-[28px] border border-white/10 bg-white/5 p-6 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
            >
              <div className="text-4xl">🎮</div>
              <h2 className="mt-4 text-2xl font-black">Arcade Mode</h2>
              <p className="mt-2 text-slate-300">
                Play a 3D arcade football mode.
              </p>
            </Link>
        </div>

      </div>

    </main>
  )
}