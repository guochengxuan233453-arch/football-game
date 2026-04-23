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

type MatchOption = {
  id: string
  name: string
  opponentOvr: number
  rewardCoins: number
  description: string
}

type PlayerCardData = {
  id: string
  name: string
  baseId?: string
  rating: number
  position: string
  altPositions?: string[]
  cardImage: string
  skill?: string
  stats: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
    diving: number
    handling: number
    reflexes: number
    positioning: number
  }
}

type DuelCard = {
  hiddenId: string
  player: PlayerCardData
}

type ActiveChance = {
  type: "attack" | "defense"
  selectablePlayers: PlayerCardData[]
  opponentPlayer: PlayerCardData
  keeper: PlayerCardData
  duelCards: DuelCard[]
}

type CommentaryItem = {
  id: string
  minute: number
  text: string
}

const MATCHES: MatchOption[] = [
  {
    id: "starter",
    name: "Starter Clash",
    opponentOvr: 85,
    rewardCoins: 10000,
    description: "Easier team with weaker duels.",
  },
  {
    id: "pro",
    name: "Pro Challenge",
    opponentOvr: 90,
    rewardCoins: 25000,
    description: "Balanced team and tougher chances.",
  },
  {
    id: "elite",
    name: "Elite Showdown",
    opponentOvr: 99,
    rewardCoins: 50000,
    description: "Top level team with strong attack and defense.",
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function shuffleArray<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
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

function isMidfielder(pos: string) {
  return ["CM", "CDM", "CAM", "LM", "RM"].includes(pos.toUpperCase())
}

function isAttacker(pos: string) {
  return ["ST", "CF", "LW", "RW"].includes(pos.toUpperCase())
}

function isDefender(pos: string) {
  return ["LB", "RB", "CB"].includes(pos.toUpperCase())
}

function getStatBlock(player: InventoryPlayer) {
  const base = player.rating
  const isGK = player.position.toUpperCase() === "GK"

  return {
    pace: player.stats?.pace ?? clamp(isGK ? base - 30 : base + 1, 1, 99),
    shooting: player.stats?.shooting ?? clamp(isGK ? 20 : base, 1, 99),
    passing: player.stats?.passing ?? clamp(isGK ? base - 5 : base - 1, 1, 99),
    dribbling: player.stats?.dribbling ?? clamp(isGK ? base - 20 : base, 1, 99),
    defending: player.stats?.defending ?? clamp(isGK ? base : base - 5, 1, 99),
    physical: player.stats?.physical ?? clamp(base - 2, 1, 99),
    diving: player.stats?.diving ?? clamp(isGK ? base : base - 20, 1, 99),
    handling: player.stats?.handling ?? clamp(isGK ? base : base - 20, 1, 99),
    reflexes: player.stats?.reflexes ?? clamp(isGK ? base : base - 20, 1, 99),
    positioning: player.stats?.positioning ?? clamp(isGK ? base : base - 20, 1, 99),
  }
}

function createAiPlayer(name: string, rating: number, position: string): PlayerCardData {
  const base = clamp(rating, 1, 99)

  if (position === "GK") {
    return {
      id: `${name}-${position}-${Math.random()}`,
      name,
      rating: base,
      position,
      altPositions: [],
      cardImage: "/cards/default.png",
      stats: {
        pace: clamp(base - 30, 1, 99),
        shooting: 20,
        passing: clamp(base - 8, 1, 99),
        dribbling: clamp(base - 20, 1, 99),
        defending: clamp(base, 1, 99),
        physical: clamp(base - 4, 1, 99),
        diving: clamp(base + 1, 1, 99),
        handling: clamp(base, 1, 99),
        reflexes: clamp(base + 1, 1, 99),
        positioning: clamp(base, 1, 99),
      },
    }
  }

  if (isAttacker(position)) {
    return {
      id: `${name}-${position}-${Math.random()}`,
      name,
      rating: base,
      position,
      altPositions: [],
      cardImage: "/cards/default.png",
      stats: {
        pace: clamp(base + 2, 1, 99),
        shooting: clamp(base + 2, 1, 99),
        passing: clamp(base - 1, 1, 99),
        dribbling: clamp(base + 1, 1, 99),
        defending: clamp(base - 10, 1, 99),
        physical: clamp(base, 1, 99),
        diving: 10,
        handling: 10,
        reflexes: 10,
        positioning: 10,
      },
    }
  }

  if (isMidfielder(position)) {
    return {
      id: `${name}-${position}-${Math.random()}`,
      name,
      rating: base,
      position,
      altPositions: [],
      cardImage: "/cards/default.png",
      stats: {
        pace: clamp(base, 1, 99),
        shooting: clamp(base - 1, 1, 99),
        passing: clamp(base + 2, 1, 99),
        dribbling: clamp(base + 1, 1, 99),
        defending: clamp(base - 2, 1, 99),
        physical: clamp(base - 1, 1, 99),
        diving: 10,
        handling: 10,
        reflexes: 10,
        positioning: 10,
      },
    }
  }

  return {
    id: `${name}-${position}-${Math.random()}`,
    name,
    rating: base,
    position,
    altPositions: [],
    cardImage: "/cards/default.png",
    stats: {
      pace: clamp(base - 1, 1, 99),
      shooting: clamp(base - 8, 1, 99),
      passing: clamp(base - 2, 1, 99),
      dribbling: clamp(base - 3, 1, 99),
      defending: clamp(base + 2, 1, 99),
      physical: clamp(base + 1, 1, 99),
      diving: 10,
      handling: 10,
      reflexes: 10,
      positioning: 10,
    },
  }
}

function buildAiTeam(opponentOvr: number): PlayerCardData[] {
  const positions = ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CAM", "LW", "ST", "RW"]
  return positions.map((position, index) =>
    createAiPlayer(`Rivals ${position} ${index + 1}`, opponentOvr, position)
  )
}

function getUserTeamCards(): PlayerCardData[] {
  const inventory = getInventory()
  const squad = getSquad()

  const squadPlayers = Object.entries(squad.slots)
    .map(([slot, playerId]) => {
      const player = inventory.find((p) => p.id === playerId)
      if (!player) return null
      return { player, slot }
    })
    .filter((entry): entry is { player: InventoryPlayer; slot: string } => Boolean(entry))

  const hasAttackBoost = squadPlayers.some(
    ({ player }) => player.baseId === "r9_100" || player.skill === "attack_boost_1"
  )

  return squadPlayers.map(({ player, slot }) => {
    const position = normalizeSlotToPosition(slot)
    const boostedRating = hasAttackBoost && isAttacker(position) ? player.rating + 1 : player.rating

    return {
      id: player.id,
      baseId: player.baseId,
      name: player.name,
      rating: boostedRating,
      position,
      altPositions: player.altPositions ?? [],
      cardImage: player.cardImage,
      skill: player.skill,
      stats: getStatBlock(player),
    }
  })
}

function getSquadOvr(team: PlayerCardData[]) {
  if (team.length === 0) return 0
  return Math.round(average(team.map((p) => p.rating)))
}

function getMidfieldStrength(team: PlayerCardData[]) {
  const mids = team.filter((p) => isMidfielder(p.position))
  return {
    ovr: average(mids.map((p) => p.rating)),
    passDribble: average(mids.map((p) => (p.stats.passing + p.stats.dribbling) / 2)),
  }
}

function getChanceProbability(userTeam: PlayerCardData[], aiTeam: PlayerCardData[], side: "user" | "ai") {
  const userMid = getMidfieldStrength(userTeam)
  const aiMid = getMidfieldStrength(aiTeam)

  let edge = 0

  if (Math.round(userMid.ovr) !== Math.round(aiMid.ovr)) {
    edge = userMid.ovr - aiMid.ovr
  } else {
    edge = (userMid.passDribble - aiMid.passDribble) / 2
  }

  const signedEdge = side === "user" ? edge : -edge
  return clamp(0.18 + signedEdge * 0.01, 0.06, 0.42)
}

function getAttackers(team: PlayerCardData[]) {
  return team.filter((p) => isAttacker(p.position)).slice(0, 3)
}

function getDefenders(team: PlayerCardData[]) {
  return team.filter((p) => isDefender(p.position)).slice(0, 3)
}

function getKeeper(team: PlayerCardData[]) {
  return team.find((p) => p.position === "GK") ?? team[0]
}

function buildChance(type: "attack" | "defense", userTeam: PlayerCardData[], aiTeam: PlayerCardData[]): ActiveChance {
  if (type === "attack") {
    const selectablePlayers = getAttackers(userTeam)
    const opponentPlayer = getDefenders(aiTeam)[Math.floor(Math.random() * 3)]
    return {
      type,
      selectablePlayers,
      opponentPlayer,
      keeper: getKeeper(aiTeam),
      duelCards: shuffleArray(
        selectablePlayers.map((player, i) => ({
          hiddenId: `ua-${i}-${player.id}`,
          player,
        }))
      ),
    }
  }

  const selectablePlayers = getDefenders(userTeam)
  const opponentPlayer = getAttackers(aiTeam)[Math.floor(Math.random() * 3)]
  return {
    type,
    selectablePlayers,
    opponentPlayer,
    keeper: getKeeper(userTeam),
    duelCards: shuffleArray(
      selectablePlayers.map((player, i) => ({
        hiddenId: `ud-${i}-${player.id}`,
        player,
      }))
    ),
  }
}

function duelAgainst(
  type: "attack" | "defense",
  chosen: PlayerCardData,
  opponent: PlayerCardData
) {
  if (type === "attack") {
    if (chosen.rating > opponent.rating) {
      return true
    }
    if (chosen.rating < opponent.rating) {
      return false
    }

    const attackerTie = chosen.stats.pace
    const defenderTie = (opponent.stats.defending + opponent.stats.physical) / 2
    return attackerTie > defenderTie
  }

  if (chosen.rating > opponent.rating) {
    return true
  }
  if (chosen.rating < opponent.rating) {
    return false
  }

  const attackerTie = opponent.stats.pace
  const defenderTie = (chosen.stats.defending + chosen.stats.physical) / 2
  return defenderTie > attackerTie
}

function getGoalkeeperPower(keeper: PlayerCardData) {
  return average([keeper.stats.diving, keeper.stats.reflexes, keeper.stats.positioning])
}

function getScoringBoxCount(shooting: number, keeperPower: number) {
  const diff = shooting - keeperPower
  return clamp(6 + Math.floor(diff / 2), 2, 10)
}

function makeGoalBoxes(count: number) {
  return shuffleArray(Array.from({ length: 12 }, (_, i) => i)).slice(0, count)
}

function getShotTimerSeconds(pressurePlayers: PlayerCardData[]) {
  const pacePressure = average(pressurePlayers.map((p) => p.stats.pace))
  return clamp(20 - Math.floor(pacePressure / 10), 6, 20)
}

export default function MatchPage() {
  const [phase, setPhase] = useState<"idle" | "simulating" | "finished">("idle")
  const [selectedMatch, setSelectedMatch] = useState<MatchOption | null>(null)
  const [userTeam, setUserTeam] = useState<PlayerCardData[]>([])
  const [aiTeam, setAiTeam] = useState<PlayerCardData[]>([])
  const [coins, setCoins] = useState(0)

  const [timeElapsed, setTimeElapsed] = useState(0)
  const [simDots, setSimDots] = useState(".")
  const [score, setScore] = useState({ user: 0, ai: 0 })
  const [commentary, setCommentary] = useState<CommentaryItem[]>([])

  const [activeChance, setActiveChance] = useState<ActiveChance | null>(null)
  const [chanceMessage, setChanceMessage] = useState("")
  const [pickedCardId, setPickedCardId] = useState<string | null>(null)
  const [duelChosen, setDuelChosen] = useState<PlayerCardData | null>(null)
  const [duelOpponent, setDuelOpponent] = useState<PlayerCardData | null>(null)
  const [duelResolved, setDuelResolved] = useState(false)

  const [awaitingContinue, setAwaitingContinue] = useState(false)
  const [pendingDuelResult, setPendingDuelResult] = useState<{
    success: boolean
    nextPlayer: PlayerCardData | null
  } | null>(null)

  const [shotStage, setShotStage] = useState(false)
  const [shooter, setShooter] = useState<PlayerCardData | null>(null)
  const [keeper, setKeeper] = useState<PlayerCardData | null>(null)
  const [goalBoxes, setGoalBoxes] = useState<number[]>([])
  const [pickedBox, setPickedBox] = useState<number | null>(null)
  const [shotResolved, setShotResolved] = useState(false)
  const [shotResultMessage, setShotResultMessage] = useState("")
  const [shotTimer, setShotTimer] = useState(0)
  const [shotTimerActive, setShotTimerActive] = useState(false)

  const phaseRef = useRef(phase)
  const activeChanceRef = useRef<ActiveChance | null>(activeChance)

  const squadOvr = useMemo(() => getSquadOvr(userTeam), [userTeam])

  function addComment(text: string, minuteOverride?: number) {
    const minute = minuteOverride ?? Math.max(1, timeElapsed)
    setCommentary((prev) => [
      { id: `${Date.now()}-${Math.random()}`, minute, text },
      ...prev,
    ].slice(0, 20))
  }

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    activeChanceRef.current = activeChance
  }, [activeChance])

  useEffect(() => {
    setCoins(getUserData().coins)
    setUserTeam(getUserTeamCards())
  }, [])

  useEffect(() => {
    if (phase !== "simulating") return
    if (activeChance) return

    const interval = window.setInterval(() => {
      if (phaseRef.current !== "simulating") return
      if (activeChanceRef.current) return

      setTimeElapsed((prev) => {
        const next = prev + 1
        if (next >= 90) {
          window.clearInterval(interval)
          finishMatch()
        }
        return next
      })

      setSimDots((prev) => {
        if (prev === "...") return "."
        if (prev === "..") return "..."
        return ".."
      })

      const userChance = Math.random() < getChanceProbability(userTeam, aiTeam, "user")
      const aiChance = Math.random() < getChanceProbability(userTeam, aiTeam, "ai")

      if (userChance) {
        addComment("Your side creates a chance.")
        openChance("attack")
      } else if (aiChance) {
        addComment("The opponents create a chance.")
        openChance("defense")
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [phase, activeChance, userTeam, aiTeam, timeElapsed])

  useEffect(() => {
    if (!shotTimerActive) return

    const interval = window.setInterval(() => {
      setShotTimer((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval)
          setShotTimerActive(false)
          setShotResolved(true)
          setShotResultMessage("Chance missed")
          addComment("Chance missed.")
          setTimeout(() => {
            clearChanceState()
          }, 1400)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [shotTimerActive, timeElapsed])

  const resultText =
    score.user > score.ai ? "You won" : score.user < score.ai ? "You lost" : "Draw"

  function canSkipMatch() {
    return phase === "simulating" && score.user - score.ai >= 4
  }

  function startMatch(match: MatchOption) {
    const currentUserTeam = getUserTeamCards()
    setUserTeam(currentUserTeam)
    setAiTeam(buildAiTeam(match.opponentOvr))
    setSelectedMatch(match)
    setPhase("simulating")
    setTimeElapsed(0)
    setSimDots(".")
    setScore({ user: 0, ai: 0 })
    setCommentary([{ id: "kickoff", minute: 0, text: "Kick-off!" }])
    clearChanceState()
  }

  function finishMatch() {
    setPhase("finished")
    clearChanceState()

    if (!selectedMatch) return

    if (score.user > score.ai) {
      const user = getUserData()
      const updatedCoins = user.coins + selectedMatch.rewardCoins
      saveUserData({ ...user, coins: updatedCoins })
      setCoins(updatedCoins)
      addComment(`Full time. You win ${score.user}-${score.ai} and earn ${selectedMatch.rewardCoins} coins.`, 90)
    } else if (score.user < score.ai) {
      addComment(`Full time. You lose ${score.user}-${score.ai}.`, 90)
    } else {
      addComment(`Full time. It ends ${score.user}-${score.ai}.`, 90)
    }
  }

  function skipMatch() {
    if (!selectedMatch) return
    setTimeElapsed(90)
    setPhase("finished")
    clearChanceState()

    const user = getUserData()
    const updatedCoins = user.coins + selectedMatch.rewardCoins
    saveUserData({ ...user, coins: updatedCoins })
    setCoins(updatedCoins)

    addComment("Match skipped. Comfortable win secured.", 90)
  }

  function clearChanceState() {
    setActiveChance(null)
    setChanceMessage("")
    setPickedCardId(null)
    setDuelChosen(null)
    setDuelOpponent(null)
    setDuelResolved(false)
    setAwaitingContinue(false)
    setPendingDuelResult(null)
    setShotStage(false)
    setShooter(null)
    setKeeper(null)
    setGoalBoxes([])
    setPickedBox(null)
    setShotResolved(false)
    setShotResultMessage("")
    setShotTimer(0)
    setShotTimerActive(false)
  }

  function openChance(type: "attack" | "defense") {
    const built = buildChance(type, userTeam, aiTeam)
    setActiveChance(built)
    setChanceMessage(type === "attack" ? "Your chance!" : "Opponent chance!")
    setPickedCardId(null)
    setDuelChosen(null)
    setDuelOpponent(null)
    setDuelResolved(false)
    setAwaitingContinue(false)
    setPendingDuelResult(null)
    setShotStage(false)
    setShooter(null)
    setKeeper(null)
    setGoalBoxes([])
    setPickedBox(null)
    setShotResolved(false)
    setShotResultMessage("")
    setShotTimer(0)
    setShotTimerActive(false)
  }

  function handlePickCard(card: DuelCard) {
    if (!activeChance || duelResolved) return

    const success = duelAgainst(activeChance.type, card.player, activeChance.opponentPlayer)

    setPickedCardId(card.hiddenId)
    setDuelChosen(card.player)
    setDuelOpponent(activeChance.opponentPlayer)
    setDuelResolved(true)
    setAwaitingContinue(true)

    setPendingDuelResult({
      success,
      nextPlayer: success ? card.player : activeChance.type === "attack" ? null : activeChance.opponentPlayer,
    })
  }

  function handleContinueAfterDuel() {
    if (!activeChance || !pendingDuelResult || !duelChosen || !duelOpponent) return

    setAwaitingContinue(false)

    if (activeChance.type === "attack") {
      if (pendingDuelResult.success && pendingDuelResult.nextPlayer) {
        addComment(`${duelChosen.name} beats ${duelOpponent.name} in the duel.`)
        beginShotStage(
          pendingDuelResult.nextPlayer,
          activeChance.keeper,
          activeChance.selectablePlayers
        )
      } else {
        addComment(`${duelOpponent.name} wins the duel. Chance missed.`)
        setChanceMessage("Chance missed")
        setTimeout(() => clearChanceState(), 800)
      }
    } else {
      if (pendingDuelResult.success) {
        addComment(`${duelChosen.name} stops ${duelOpponent.name}.`)
        setChanceMessage("You stopped the chance")
        setTimeout(() => clearChanceState(), 800)
      } else {
        addComment(`${duelOpponent.name} gets through. Big danger.`)
        beginShotStage(
          duelOpponent,
          activeChance.keeper,
          activeChance.selectablePlayers
        )
      }
    }

    setPendingDuelResult(null)
  }

  function beginShotStage(
    nextShooter: PlayerCardData,
    nextKeeper: PlayerCardData,
    pressurePlayers: PlayerCardData[]
  ) {
    const keeperPower = getGoalkeeperPower(nextKeeper)
    const boxCount = getScoringBoxCount(nextShooter.stats.shooting, keeperPower)

    setShotStage(true)
    setShooter(nextShooter)
    setKeeper(nextKeeper)
    setGoalBoxes(makeGoalBoxes(boxCount))
    setPickedBox(null)
    setShotResolved(false)
    setShotResultMessage("")
    setShotTimer(getShotTimerSeconds(pressurePlayers))
    setShotTimerActive(true)
  }

  function handleChooseBox(index: number) {
    if (!activeChance || !shooter || !keeper || shotResolved) return

    setShotTimerActive(false)
    setPickedBox(index)
    setShotResolved(true)

    const scored = goalBoxes.includes(index)

    if (activeChance.type === "attack") {
      if (scored) {
        setScore((prev) => ({ ...prev, user: prev.user + 1 }))
        setShotResultMessage("GOAL!")
        addComment(`GOAL! ${shooter.name} scores for your team.`)
      } else {
        setShotResultMessage("Chance missed")
        addComment(`${shooter.name} misses the chance.`)
      }
    } else {
      if (scored) {
        setScore((prev) => ({ ...prev, ai: prev.ai + 1 }))
        setShotResultMessage("GOAL!")
        addComment(`Goal for the opponents. ${shooter.name} finishes it.`)
      } else {
        setShotResultMessage("Chance missed")
        addComment(`Great save. ${keeper.name} keeps it out.`)
      }
    }

    setTimeout(() => {
      clearChanceState()
    }, 1600)
  }

  const squadCount = userTeam.length

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_20%),linear-gradient(to_bottom,#020617,#000000)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Match</p>
            <h1 className="text-3xl font-black">Interactive Sim Match</h1>
            <p className="mt-1 text-slate-300">
              90-second sim with commentary, duel reveals, and timed finishing.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-400">Coins</div>
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

        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Match State</h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-4 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400">Timer</div>
                <div className="mt-2 text-4xl font-black">{timeElapsed}s</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400">Score</div>
                <div className="mt-2 whitespace-nowrap text-4xl font-black leading-none">
                  {score.user} - {score.ai}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400">Sim</div>
                <div className="mt-2 text-2xl font-black">
                  {phase === "simulating" ? `Sim${simDots}` : phase === "finished" ? "Finished" : "Idle"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400">Squad Players</div>
                <div className="mt-2 text-4xl font-black">{squadCount}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <div className="text-xs uppercase tracking-widest text-slate-400">Squad OVR</div>
                <div className="mt-2 text-4xl font-black">{squadOvr}</div>
              </div>
            </div>

            {canSkipMatch() && (
              <button
                onClick={skipMatch}
                className="mt-4 w-full rounded-2xl bg-green-400 px-6 py-3 font-black text-slate-950"
              >
                Skip Match (Winning by 4+)
              </button>
            )}

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="mb-3 text-lg font-black">Live Commentary</div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {commentary.length === 0 && (
                  <div className="text-slate-400">No events yet.</div>
                )}
                {commentary.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="mr-2 font-black text-cyan-300">{item.minute}'</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {phase === "finished" && selectedMatch && (
              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-center">
                <div className="text-3xl font-black">{resultText}</div>
                <div className="mt-2 text-slate-300">
                  Final score: {score.user} - {score.ai}
                </div>
                <div className="mt-2 font-bold text-yellow-300">
                  {score.user > score.ai ? `+${selectedMatch.rewardCoins} coins` : "+0 coins"}
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Matches</h2>

            <div className="mt-6 space-y-4">
              {MATCHES.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="text-xl font-black">{match.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{match.description}</div>
                  <div className="mt-3 text-sm text-slate-300">
                    Opponent OVR: {match.opponentOvr}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Your OVR: {squadOvr}
                  </div>
                  <div className="text-sm font-bold text-yellow-300">
                    Win reward: {match.rewardCoins}
                  </div>

                  <button
                    onClick={() => startMatch(match)}
                    disabled={phase === "simulating"}
                    className="mt-4 w-full rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950 disabled:opacity-50"
                  >
                    Play Match
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {activeChance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">
                {activeChance.type === "attack" ? "Attack Chance" : "Defend Chance"}
              </p>
              <h2 className="mt-2 text-3xl font-black">{chanceMessage}</h2>
            </div>

            {!shotStage && (
              <>
                <div className="mt-6 text-center text-slate-300">
                  {activeChance.type === "attack"
                    ? "Pick one of your attackers."
                    : "Pick one of your defenders."}
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {activeChance.duelCards.map((card) => {
                    const revealed = pickedCardId === card.hiddenId

                    return (
                      <button
                        key={card.hiddenId}
                        onClick={() => handlePickCard(card)}
                        disabled={duelResolved}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition hover:bg-white/10 disabled:opacity-80"
                      >
                        {!revealed ? (
                          <div className="flex flex-col items-center">
                            <div className="flex h-32 w-full items-center justify-center text-5xl font-black text-slate-500">
                              ?
                            </div>
                            <div className="mt-2 text-sm font-bold text-slate-300">Hidden Card</div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Image
                              src={card.player.cardImage}
                              alt={card.player.name}
                              width={92}
                              height={132}
                              className="mb-3 rounded-xl object-cover"
                            />
                            <div className="text-lg font-black">{card.player.name}</div>
                            <div className="text-sm text-slate-300">
                              {card.player.rating} • {card.player.position}
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {duelResolved && duelChosen && duelOpponent && (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                    <div className="mb-4 text-xl font-black">Duel Reveal</div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-4">
                        <Image
                          src={duelChosen.cardImage}
                          alt={duelChosen.name}
                          width={112}
                          height={160}
                          className="mb-3 rounded-xl object-cover"
                        />
                        <div className="text-lg font-black">{duelChosen.name}</div>
                        <div className="text-sm text-slate-300">
                          {duelChosen.rating} • {duelChosen.position}
                        </div>
                      </div>

                      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-4">
                        <Image
                          src={duelOpponent.cardImage}
                          alt={duelOpponent.name}
                          width={112}
                          height={160}
                          className="mb-3 rounded-xl object-cover"
                        />
                        <div className="text-lg font-black">{duelOpponent.name}</div>
                        <div className="text-sm text-slate-300">
                          {duelOpponent.rating} • {duelOpponent.position}
                        </div>
                      </div>
                    </div>

                    {awaitingContinue && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={handleContinueAfterDuel}
                          className="rounded-2xl bg-cyan-400 px-6 py-3 font-black text-slate-950"
                        >
                          Continue
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {shotStage && shooter && keeper && (
              <div className="mt-8">
                <div className="mb-4 text-center">
                  <div className="text-xl font-black">
                    {activeChance.type === "attack" ? "Shoot!" : "Save it!"}
                  </div>
                  <div className="mt-1 text-slate-300">
                    Shooter: {shooter.name} ({shooter.stats.shooting} SHO) • Keeper: {keeper.name} (
                    {Math.round(getGoalkeeperPower(keeper))} GK)
                  </div>
                  <div className="mt-3 text-2xl font-black text-yellow-300">
                    Time: {shotTimer}s
                  </div>
                </div>

                <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/20 p-6">
                  <div className="mb-4 text-center font-black">Goal</div>

                  <div className="mx-auto mb-6 flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Image
                      src={keeper.cardImage}
                      alt={keeper.name}
                      width={72}
                      height={104}
                      className="rounded-xl object-cover"
                    />
                    <div className="text-left">
                      <div className="font-black">{keeper.name}</div>
                      <div className="text-sm text-slate-300">
                        GK • DIV {keeper.stats.diving} • REF {keeper.stats.reflexes} • POS {keeper.stats.positioning}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {Array.from({ length: 12 }).map((_, index) => {
                      const isGoalBox = goalBoxes.includes(index)
                      const isPicked = pickedBox === index

                      let boxClass = "bg-white/10 hover:bg-white/20"
                      if (shotResolved) {
                        if (activeChance.type === "attack") {
                          if (isPicked && isGoalBox) boxClass = "bg-green-500/80"
                          else if (isPicked && !isGoalBox) boxClass = "bg-red-500/80"
                          else if (isGoalBox) boxClass = "bg-green-500/40"
                          else boxClass = "bg-red-500/20"
                        } else {
                          if (isPicked && isGoalBox) boxClass = "bg-red-500/80"
                          else if (isPicked && !isGoalBox) boxClass = "bg-green-500/80"
                          else if (isGoalBox) boxClass = "bg-red-500/40"
                          else boxClass = "bg-green-500/20"
                        }
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => handleChooseBox(index)}
                          disabled={shotResolved}
                          className={`h-20 rounded-2xl border border-white/10 transition ${boxClass}`}
                        >
                          {shotResolved && isPicked ? <span className="text-2xl">●</span> : null}
                        </button>
                      )
                    })}
                  </div>

                  {shotResolved && (
                    <div className="mt-6 text-center text-3xl font-black">
                      {shotResultMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}