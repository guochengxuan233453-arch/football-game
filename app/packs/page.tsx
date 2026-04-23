"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { addPlayerToInventory, getUserData, saveUserData } from "@/lib/storage"
import { PackType, getRandomPlayerForPack, packs } from "@/lib/players"

type PlayerCard = {
  id: string
  baseId: string
  name: string
  rating: number
  position: string
  nationFlag: string
  clubLogo: string
  cardImage: string
  rarity: "gold" | "elite" | "icon" 
  walkoutType: "normal" | "big"
}

export default function PacksPage() {
  const [stage, setStage] = useState<"idle" | "tunnel" | "flag" | "position" | "club" | "card">("idle")
  const [player, setPlayer] = useState<PlayerCard | null>(null)
  const [selectedPack, setSelectedPack] = useState<PackType>("bronze")
  const [coins, setCoins] = useState<number>(() => getUserData().coins)
  const [message, setMessage] = useState("")

  function openPack() {
    if (stage !== "idle") return

    const user = getUserData()
    const price = packs[selectedPack].price

    if (user.coins < price) {
      setMessage("Not enough coins.")
      return
    }

    const basePlayer = getRandomPlayerForPack(selectedPack)

    const packedPlayer: PlayerCard = {
      ...basePlayer,
      id: `${basePlayer.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    }

    const updatedUser = {
      ...user,
      coins: user.coins - price,
    }

    saveUserData(updatedUser)
    setCoins(updatedUser.coins)

    setPlayer(packedPlayer)
    addPlayerToInventory(packedPlayer)
    setMessage(`You opened a ${packs[selectedPack].name}.`)

    setStage("tunnel")
    setTimeout(() => setStage("flag"), 1700)
    setTimeout(() => setStage("position"), 2900)
    setTimeout(() => setStage("club"), 4100)
    setTimeout(() => setStage("card"), 5400)
  }

  function resetPack() {
    setStage("idle")
    setPlayer(null)
  }

  const revealActive =
    stage === "tunnel" ||
    stage === "flag" ||
    stage === "position" ||
    stage === "club" ||
    stage === "card"

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.10),transparent_20%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Store</p>
            <h1 className="text-3xl font-black">Pack Opening</h1>
            <p className="mt-1 text-slate-300">Choose a pack and open it with coins.</p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-400">Coins</div>
              <div className="text-2xl font-black">{coins}</div>
            </div>

            <Link href="/" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10">
              Main Menu
            </Link>
          </div>
        </header>

        <section className="relative flex min-h-[720px] items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-black/30 p-6 backdrop-blur">
          {stage === "idle" && (
            <div className="flex flex-col items-center">
              <div className="mb-6 flex flex-wrap justify-center gap-4">
                {(["bronze", "gold", "elite"] as PackType[]).map((packKey) => (
                  <button
                    key={packKey}
                    onClick={() => setSelectedPack(packKey)}
                    className={`rounded-2xl border px-5 py-4 text-left transition ${
                      selectedPack === packKey
                        ? "border-cyan-300 bg-cyan-300/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-black">{packs[packKey].name}</div>
                    <div className="mt-1 text-sm text-slate-300">Price: {packs[packKey].price} coins</div>
                    <div className="mt-2 text-xs text-slate-400">
                      Gold {Math.round(packs[packKey].odds.gold * 100)}% • Elite {Math.round(packs[packKey].odds.elite * 100)}% • Icon {Math.round(packs[packKey].odds.icon * 100)}%
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-[30px] border border-cyan-400/30 bg-gradient-to-b from-slate-800 to-slate-950 p-6 shadow-[0_0_60px_rgba(34,211,238,0.18)]">
                <div className="flex h-[380px] w-[260px] items-center justify-center rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_45%),linear-gradient(to_bottom,#111827,#020617)]">
                  <div className="text-center">
                    <div className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-cyan-300">
                      {packs[selectedPack].name}
                    </div>
                    <div className="text-7xl">⚽</div>
                    <div className="mt-4 text-lg font-bold text-white">Tap to open</div>
                  </div>
                </div>
              </div>

              <button
                onClick={openPack}
                className="mt-8 rounded-2xl bg-cyan-400 px-8 py-4 text-lg font-black text-slate-950 transition hover:scale-105"
              >
                Buy and Open Pack
              </button>

              {message && <p className="mt-4 text-slate-300">{message}</p>}
            </div>
          )}

          {revealActive && (
            <div className="relative h-[640px] w-full overflow-hidden rounded-[28px]">
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

              {stage === "flag" && player && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
                    <Image
                      src={player.nationFlag}
                      alt="Nation flag"
                      width={220}
                      height={140}
                      className="rounded-xl object-contain"
                    />
                  </div>
                </div>
              )}

              {stage === "position" && player && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-3xl border border-white/10 bg-black/30 px-16 py-10 text-center shadow-2xl backdrop-blur">
                    <div className="text-8xl font-black tracking-wider text-white">
                      {player.position}
                    </div>
                  </div>
                </div>
              )}

              {stage === "club" && player && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur">
                    <Image
                      src={player.clubLogo}
                      alt="Club badge"
                      width={180}
                      height={180}
                      className="object-contain"
                    />
                  </div>
                </div>
              )}

              {stage === "card" && player && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Image
                    src={player.cardImage}
                    alt={player.name}
                    width={340}
                    height={500}
                    priority
                    className="rounded-[28px] shadow-[0_0_70px_rgba(255,255,255,0.22)]"
                  />

                  <div className="mt-8 flex gap-4">
                    <button
                      onClick={resetPack}
                      className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10"
                    >
                      Back
                    </button>

                    <button
                      onClick={() => {
                        resetPack()
                        setTimeout(() => openPack(), 100)
                      }}
                      className="rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950 transition hover:scale-105"
                    >
                      Open Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

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