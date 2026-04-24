"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  getInventory,
  getSquad,
  getUserData,
  saveUserData,
  type InventoryPlayer,
} from "@/lib/storage"

type CampaignId = "manu_2008" | "milan_2007"
type Phase = "menu" | "playing" | "chance" | "finished"

type Opponent = {
  name: string
  ovr: number
  legCount: 1 | 2
}

type Campaign = {
  id: CampaignId
  name: string
  reward: number
  opponents: Opponent[]
}

type PlayerCard = {
  id: string
  name: string
  rating: number
  position: string
  cardImage: string
  stats: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
    diving: number
    reflexes: number
    positioning: number
  }
}

type SaveData = {
  campaignId: CampaignId
  roundIndex: number
  legIndex: number
  userAgg: number
  aiAgg: number
}

const SAVE_KEY = "football_tournament_run"

const CAMPAIGNS: Campaign[] = [
  {
    id: "manu_2008",
    name: "2008 Man U UCL Run",
    reward: 120000,
    opponents: [
      { name: "Lyon 2008", ovr: 88, legCount: 2 },
      { name: "Roma 2008", ovr: 90, legCount: 2 },
      { name: "Barcelona 2008", ovr: 94, legCount: 2 },
      { name: "Chelsea 2008 Final", ovr: 95, legCount: 1 },
    ],
  },
  {
    id: "milan_2007",
    name: "2007 AC Milan UCL Run",
    reward: 120000,
    opponents: [
      { name: "Celtic 2007", ovr: 86, legCount: 2 },
      { name: "Bayern 2007", ovr: 91, legCount: 2 },
      { name: "Man United 2007", ovr: 94, legCount: 2 },
      { name: "Liverpool 2007 Final", ovr: 94, legCount: 1 },
    ],
  },
]

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function avg(nums: number[]) {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function normalizeSlot(slot: string) {
  const s = slot.toLowerCase()
  if (s.startsWith("st")) return "ST"
  if (s.startsWith("lw")) return "LW"
  if (s.startsWith("rw")) return "RW"
  if (s.startsWith("cm")) return "CM"
  if (s.startsWith("cdm")) return "CDM"
  if (s.startsWith("cam")) return "CAM"
  if (s.startsWith("lb")) return "LB"
  if (s.startsWith("rb")) return "RB"
  if (s.startsWith("cb")) return "CB"
  if (s.startsWith("gk")) return "GK"
  return s.toUpperCase()
}

function isMid(pos: string) {
  return ["CM", "CDM", "CAM", "LM", "RM"].includes(pos)
}

function isAttack(pos: string) {
  return ["ST", "CF", "LW", "RW"].includes(pos)
}

function isDef(pos: string) {
  return ["LB", "RB", "CB"].includes(pos)
}

function getStats(p: InventoryPlayer) {
  const base = p.rating
  const isGk = p.position.toUpperCase() === "GK"

  return {
    pace: p.stats?.pace ?? clamp(isGk ? base - 30 : base, 1, 99),
    shooting: p.stats?.shooting ?? clamp(isGk ? 10 : base, 1, 99),
    passing: p.stats?.passing ?? base,
    dribbling: p.stats?.dribbling ?? base,
    defending: p.stats?.defending ?? clamp(isGk ? base : base - 5, 1, 99),
    physical: p.stats?.physical ?? base,
    diving: p.stats?.diving ?? clamp(isGk ? base : base - 20, 1, 99),
    reflexes: p.stats?.reflexes ?? clamp(isGk ? base : base - 20, 1, 99),
    positioning: p.stats?.positioning ?? clamp(isGk ? base : base - 20, 1, 99),
  }
}

function getUserTeam(): PlayerCard[] {
  const inv = getInventory()
  const squad = getSquad()

  return Object.entries(squad.slots)
    .map(([slot, id]) => {
      const p = inv.find((x) => x.id === id)
      if (!p) return null

      const pos = normalizeSlot(slot)

      return {
        id: p.id,
        name: p.name,
        rating: p.rating,
        position: pos,
        cardImage: p.cardImage,
        stats: getStats(p),
      }
    })
    .filter((p): p is PlayerCard => Boolean(p))
}

function makeAiTeam(name: string, ovr: number): PlayerCard[] {
  const positions = ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CAM", "LW", "ST", "RW"]

  return positions.map((pos, i) => ({
    id: `${name}-${pos}-${i}`,
    name: `${name} ${pos}`,
    rating: ovr,
    position: pos,
    cardImage: "/cards/default.png",
    stats: {
      pace: clamp(ovr, 1, 99),
      shooting: isAttack(pos) ? clamp(ovr + 2, 1, 99) : clamp(ovr - 5, 1, 99),
      passing: isMid(pos) ? clamp(ovr + 2, 1, 99) : ovr,
      dribbling: isMid(pos) || isAttack(pos) ? clamp(ovr + 1, 1, 99) : clamp(ovr - 3, 1, 99),
      defending: isDef(pos) ? clamp(ovr + 2, 1, 99) : clamp(ovr - 8, 1, 99),
      physical: isDef(pos) ? clamp(ovr + 1, 1, 99) : ovr,
      diving: pos === "GK" ? clamp(ovr + 1, 1, 99) : 10,
      reflexes: pos === "GK" ? clamp(ovr + 1, 1, 99) : 10,
      positioning: pos === "GK" ? ovr : 10,
    },
  }))
}

function midfieldPower(team: PlayerCard[]) {
  const mids = team.filter((p) => isMid(p.position))
  return {
    ovr: avg(mids.map((p) => p.rating)),
    tech: avg(mids.map((p) => (p.stats.passing + p.stats.dribbling) / 2)),
  }
}

function chanceRate(user: PlayerCard[], ai: PlayerCard[], side: "user" | "ai") {
  const u = midfieldPower(user)
  const a = midfieldPower(ai)

  let edge = 0
  if (Math.round(u.ovr) !== Math.round(a.ovr)) edge = u.ovr - a.ovr
  else edge = (u.tech - a.tech) / 2

  const signed = side === "user" ? edge : -edge

  // less chances overall for tournament
  return clamp(0.08 + signed * 0.006, 0.03, 0.22)
}

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function attackers(team: PlayerCard[]) {
  return team.filter((p) => isAttack(p.position)).slice(0, 3)
}

function defenders(team: PlayerCard[]) {
  return team.filter((p) => isDef(p.position)).slice(0, 3)
}

function keeper(team: PlayerCard[]) {
  return team.find((p) => p.position === "GK") ?? team[0]
}

function gkPower(p: PlayerCard) {
  return avg([p.stats.diving, p.stats.reflexes, p.stats.positioning])
}

function goalBoxCount(shooter: PlayerCard, gk: PlayerCard) {
  return clamp(6 + Math.floor((shooter.stats.shooting - gkPower(gk)) / 2), 2, 10)
}

function makeBoxes(count: number) {
  return [...Array(12).keys()].sort(() => Math.random() - 0.5).slice(0, count)
}

export default function TournamentPage() {
  const [phase, setPhase] = useState<Phase>("menu")
  const [save, setSave] = useState<SaveData | null>(null)

  const [userTeam, setUserTeam] = useState<PlayerCard[]>([])
  const [aiTeam, setAiTeam] = useState<PlayerCard[]>([])

  const [time, setTime] = useState(0)
  const [dots, setDots] = useState(".")
  const [score, setScore] = useState({ user: 0, ai: 0 })
  const [coins, setCoins] = useState(0)

  const [chanceSide, setChanceSide] = useState<"user" | "ai" | null>(null)
  const [choicePlayers, setChoicePlayers] = useState<PlayerCard[]>([])
  const [opponentPlayer, setOpponentPlayer] = useState<PlayerCard | null>(null)
  const [chosen, setChosen] = useState<PlayerCard | null>(null)
  const [duelPassed, setDuelPassed] = useState(false)

  const [shotMode, setShotMode] = useState(false)
  const [shooter, setShooter] = useState<PlayerCard | null>(null)
  const [shotKeeper, setShotKeeper] = useState<PlayerCard | null>(null)
  const [boxes, setBoxes] = useState<number[]>([])
  const [pickedBox, setPickedBox] = useState<number | null>(null)

  const phaseRef = useRef(phase)
  const saveRef = useRef(save)

  useEffect(() => {
    phaseRef.current = phase
    saveRef.current = save
  }, [phase, save])

  useEffect(() => {
    setCoins(getUserData().coins)
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) setSave(JSON.parse(raw))
  }, [])

  const campaign = useMemo(
    () => CAMPAIGNS.find((c) => c.id === save?.campaignId) ?? null,
    [save]
  )

  const opponent = campaign ? campaign.opponents[save?.roundIndex ?? 0] : null

  function saveRun(next: SaveData | null) {
    setSave(next)
    if (next) localStorage.setItem(SAVE_KEY, JSON.stringify(next))
    else localStorage.removeItem(SAVE_KEY)
  }

  function startCampaign(id: CampaignId) {
    const next: SaveData = {
      campaignId: id,
      roundIndex: 0,
      legIndex: 0,
      userAgg: 0,
      aiAgg: 0,
    }
    saveRun(next)
    startMatch(next)
  }

  function continueRun() {
    if (save) startMatch(save)
  }

  function startMatch(run: SaveData) {
    const camp = CAMPAIGNS.find((c) => c.id === run.campaignId)
    if (!camp) return

    const opp = camp.opponents[run.roundIndex]
    const uTeam = getUserTeam()
    const aTeam = makeAiTeam(opp.name, opp.ovr)

    setUserTeam(uTeam)
    setAiTeam(aTeam)
    setTime(0)
    setScore({ user: 0, ai: 0 })
    setDots(".")
    clearChance()
    setPhase("playing")
  }

  useEffect(() => {
    if (phase !== "playing") return

    const interval = window.setInterval(() => {
      setTime((t) => {
        const next = t + 1
        if (next >= 45) {
          window.clearInterval(interval)
          finishLeg()
        }
        return next
      })

      setDots((d) => (d === "..." ? "." : d + "."))

      if (Math.random() < chanceRate(userTeam, aiTeam, "user")) {
        openChance("user")
      } else if (Math.random() < chanceRate(userTeam, aiTeam, "ai")) {
        openChance("ai")
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [phase, userTeam, aiTeam])

  function openChance(side: "user" | "ai") {
    if (phaseRef.current !== "playing") return

    setChanceSide(side)
    setChosen(null)
    setDuelPassed(false)
    setShotMode(false)
    setPickedBox(null)

    if (side === "user") {
      setChoicePlayers(attackers(userTeam))
      setOpponentPlayer(pickRandom(defenders(aiTeam)))
    } else {
      setChoicePlayers(defenders(userTeam))
      setOpponentPlayer(pickRandom(attackers(aiTeam)))
    }

    setPhase("chance")
  }

  function pickDuel(p: PlayerCard) {
    if (!opponentPlayer || !chanceSide) return

    setChosen(p)

    let success = false

    if (chanceSide === "user") {
      if (p.rating > opponentPlayer.rating) success = true
      else if (p.rating === opponentPlayer.rating) {
        success = p.stats.pace > (opponentPlayer.stats.defending + opponentPlayer.stats.physical) / 2
      }
    } else {
      if (p.rating > opponentPlayer.rating) success = true
      else if (p.rating === opponentPlayer.rating) {
        success = (p.stats.defending + p.stats.physical) / 2 > opponentPlayer.stats.pace
      }
    }

    setDuelPassed(success)
  }

  function continueAfterDuel() {
    if (!chanceSide || !chosen || !opponentPlayer) return

    if (chanceSide === "user") {
      if (!duelPassed) {
        clearChance()
        setPhase("playing")
        return
      }

      const gk = keeper(aiTeam)
      setShooter(chosen)
      setShotKeeper(gk)
      setBoxes(makeBoxes(goalBoxCount(chosen, gk)))
      setShotMode(true)
      return
    }

    if (duelPassed) {
      clearChance()
      setPhase("playing")
      return
    }

    const gk = keeper(userTeam)
    setShooter(opponentPlayer)
    setShotKeeper(gk)
    setBoxes(makeBoxes(goalBoxCount(opponentPlayer, gk)))
    setShotMode(true)
  }

  function shoot(index: number) {
    if (!chanceSide) return

    setPickedBox(index)

    const scored = boxes.includes(index)

    if (chanceSide === "user" && scored) {
      setScore((s) => ({ ...s, user: s.user + 1 }))
    }

    if (chanceSide === "ai" && scored) {
      setScore((s) => ({ ...s, ai: s.ai + 1 }))
    }

    setTimeout(() => {
      clearChance()
      setPhase("playing")
    }, 1200)
  }

  function clearChance() {
    setChanceSide(null)
    setChoicePlayers([])
    setOpponentPlayer(null)
    setChosen(null)
    setDuelPassed(false)
    setShotMode(false)
    setShooter(null)
    setShotKeeper(null)
    setBoxes([])
    setPickedBox(null)
  }

  function finishLeg() {
    const run = saveRef.current
    if (!run) return

    const camp = CAMPAIGNS.find((c) => c.id === run.campaignId)
    if (!camp) return

    const opp = camp.opponents[run.roundIndex]

    const nextRun: SaveData = {
      ...run,
      userAgg: run.userAgg + score.user,
      aiAgg: run.aiAgg + score.ai,
      legIndex: run.legIndex + 1,
    }

    const tieFinished = nextRun.legIndex >= opp.legCount

    if (!tieFinished) {
      saveRun(nextRun)
      setPhase("finished")
      return
    }

    if (nextRun.userAgg <= nextRun.aiAgg) {
      saveRun(null)
      setPhase("finished")
      return
    }

    const nextRound = nextRun.roundIndex + 1

    if (nextRound >= camp.opponents.length) {
      const user = getUserData()
      saveUserData({ ...user, coins: user.coins + camp.reward })
      setCoins(user.coins + camp.reward)
      saveRun(null)
      setPhase("finished")
      return
    }

    saveRun({
      campaignId: nextRun.campaignId,
      roundIndex: nextRound,
      legIndex: 0,
      userAgg: 0,
      aiAgg: 0,
    })
    setPhase("finished")
  }

  function quitAndSave() {
    setPhase("menu")
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_20%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex justify-between rounded-3xl border border-white/10 bg-white/5 p-5">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Tournament</p>
            <h1 className="text-3xl font-black">Classic UCL Campaigns</h1>
            <p className="mt-1 text-slate-300">45-second legs. Knockout rounds use 2 legs.</p>
          </div>
          <Link href="/" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold">
            Main Menu
          </Link>
        </header>

        {phase === "menu" && (
          <div className="grid gap-6 md:grid-cols-2">
            {save && campaign && opponent && (
              <div className="md:col-span-2 rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-6">
                <h2 className="text-2xl font-black">Saved Run</h2>
                <p className="mt-2 text-slate-300">
                  {campaign.name} — {opponent.name}, Leg {save.legIndex + 1}/{opponent.legCount}
                </p>
                <button onClick={continueRun} className="mt-4 rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950">
                  Continue Run
                </button>
              </div>
            )}

            {CAMPAIGNS.map((c) => (
              <button
                key={c.id}
                onClick={() => startCampaign(c.id)}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10"
              >
                <h2 className="text-2xl font-black">{c.name}</h2>
                <p className="mt-2 text-slate-300">Reward: {c.reward} coins</p>
                <p className="mt-2 text-sm text-slate-400">
                  {c.opponents.map((o) => o.name).join(" → ")}
                </p>
              </button>
            ))}
          </div>
        )}

        {(phase === "playing" || phase === "chance" || phase === "finished") && campaign && opponent && save && (
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">{campaign.name}</h2>
              <p className="mt-2 text-slate-300">
                Round {save.roundIndex + 1}: {opponent.name} • Leg {save.legIndex + 1}/{opponent.legCount}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-2xl bg-black/30 p-5 text-center">
                  <div className="text-sm text-slate-400">Timer</div>
                  <div className="text-4xl font-black">{time}s</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-5 text-center">
                  <div className="text-sm text-slate-400">Score</div>
                  <div className="whitespace-nowrap text-4xl font-black">{score.user} - {score.ai}</div>
                </div>
                <div className="rounded-2xl bg-black/30 p-5 text-center">
                  <div className="text-sm text-slate-400">Sim</div>
                  <div className="text-3xl font-black">{phase === "playing" ? `Sim${dots}` : phase}</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-black/30 p-5 text-center">
                Aggregate: <span className="font-black">{save.userAgg + score.user} - {save.aiAgg + score.ai}</span>
              </div>

              {phase === "playing" && (
                <button onClick={quitAndSave} className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold">
                  Exit and Save Run
                </button>
              )}

              {phase === "finished" && (
                <button onClick={() => setPhase("menu")} className="mt-6 rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950">
                  Back to Tournament Menu
                </button>
              )}
            </section>

            <aside className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">Coins</h2>
              <p className="mt-2 text-3xl font-black text-yellow-300">{coins}</p>
            </aside>
          </div>
        )}
      </div>

      {phase === "chance" && chanceSide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-slate-950 p-6">
            {!shotMode ? (
              <>
                <h2 className="text-center text-3xl font-black">
                  {chanceSide === "user" ? "Your Chance" : "Defend Chance"}
                </h2>
                <p className="mt-2 text-center text-slate-300">
                  Pick one of your {chanceSide === "user" ? "attackers" : "defenders"}.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {choicePlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickDuel(p)}
                      disabled={Boolean(chosen)}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <Image src={p.cardImage} alt={p.name} width={90} height={126} className="mx-auto rounded-xl" />
                      <div className="mt-2 font-black">{p.name}</div>
                      <div className="text-sm text-slate-300">{p.rating} • {p.position}</div>
                    </button>
                  ))}
                </div>

                {chosen && opponentPlayer && (
                  <div className="mt-6 text-center">
                    <p className="text-xl font-black">
                      {duelPassed ? "Duel won!" : "Duel lost!"}
                    </p>
                    <p className="text-slate-300">
                      {chosen.name} vs {opponentPlayer.name}
                    </p>
                    <button onClick={continueAfterDuel} className="mt-4 rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950">
                      Continue
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-center text-3xl font-black">
                  {chanceSide === "user" ? "Shoot!" : "Save it!"}
                </h2>
                <p className="mt-2 text-center text-slate-300">
                  {shooter?.name} vs {shotKeeper?.name}
                </p>

                <div className="mx-auto mt-6 grid max-w-2xl grid-cols-4 gap-3">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const isGoal = boxes.includes(i)
                    const picked = pickedBox === i

                    let cls = "bg-white/10 hover:bg-white/20"
                    if (pickedBox !== null) {
                      if (chanceSide === "user") {
                        cls = isGoal ? "bg-green-500/50" : "bg-red-500/30"
                        if (picked) cls = isGoal ? "bg-green-500" : "bg-red-500"
                      } else {
                        cls = isGoal ? "bg-red-500/50" : "bg-green-500/30"
                        if (picked) cls = isGoal ? "bg-red-500" : "bg-green-500"
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => shoot(i)}
                        disabled={pickedBox !== null}
                        className={`h-20 rounded-2xl border border-white/10 ${cls}`}
                      />
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}