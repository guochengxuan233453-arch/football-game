"use client"

import Link from "next/link"
import { Canvas, useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { getInventory, getSquad, type InventoryPlayer } from "@/lib/storage"

type Team = "user" | "ai"

type GamePlayer = {
  id: string
  name: string
  position: string
  team: Team
  start: THREE.Vector3
  stats: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
  }
}

const FIELD_W = 26
const FIELD_H = 38
const GOAL_WIDTH = 7
const USER_GOAL_Z = 18
const AI_GOAL_Z = -18

function stat(p: InventoryPlayer, key: keyof GamePlayer["stats"]) {
  return p.stats?.[key] ?? p.rating
}

function getSquadPlayers() {
  const inventory = getInventory()
  const squad = getSquad()

  return Object.values(squad.slots)
    .map((id) => inventory.find((p) => p.id === id))
    .filter((p): p is InventoryPlayer => Boolean(p))
}

function makeUserPlayer(p: InventoryPlayer, start: THREE.Vector3): GamePlayer {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    team: "user",
    start,
    stats: {
      pace: stat(p, "pace"),
      shooting: stat(p, "shooting"),
      passing: stat(p, "passing"),
      dribbling: stat(p, "dribbling"),
      defending: stat(p, "defending"),
      physical: stat(p, "physical"),
    },
  }
}

function defaultPlayer(name: string, position: string, start: THREE.Vector3): GamePlayer {
  return {
    id: name,
    name,
    position,
    team: "user",
    start,
    stats: {
      pace: 75,
      shooting: 75,
      passing: 75,
      dribbling: 75,
      defending: 50,
      physical: 70,
    },
  }
}

function getUserAttackers() {
  const squad = getSquadPlayers()

  const st = squad.find((p) => p.position === "ST") ?? squad[0]
  const lw = squad.find((p) => p.position === "LW") ?? squad[1]
  const rw = squad.find((p) => p.position === "RW") ?? squad[2]

  if (!st) {
    return [
      defaultPlayer("Default ST", "ST", new THREE.Vector3(0, 0, 8)),
      defaultPlayer("Default LW", "LW", new THREE.Vector3(-5, 0, 10)),
      defaultPlayer("Default RW", "RW", new THREE.Vector3(5, 0, 10)),
    ]
  }

  return [
    makeUserPlayer(st, new THREE.Vector3(0, 0, 8)),
    makeUserPlayer(lw ?? st, new THREE.Vector3(-5, 0, 10)),
    makeUserPlayer(rw ?? st, new THREE.Vector3(5, 0, 10)),
  ]
}

function makeAiDefenders(): GamePlayer[] {
  return [
    {
      id: "ai-cb",
      name: "AI CB",
      position: "CB",
      team: "ai",
      start: new THREE.Vector3(0, 0, -5),
      stats: { pace: 82, shooting: 55, passing: 75, dribbling: 70, defending: 90, physical: 88 },
    },
    {
      id: "ai-lb",
      name: "AI LB",
      position: "LB",
      team: "ai",
      start: new THREE.Vector3(-5, 0, -4),
      stats: { pace: 88, shooting: 55, passing: 76, dribbling: 78, defending: 86, physical: 82 },
    },
    {
      id: "ai-rb",
      name: "AI RB",
      position: "RB",
      team: "ai",
      start: new THREE.Vector3(5, 0, -4),
      stats: { pace: 88, shooting: 55, passing: 76, dribbling: 78, defending: 86, physical: 82 },
    },
  ]
}

function PlayerModel({
  player,
  controlled,
  setRef,
}: {
  player: GamePlayer
  controlled: boolean
  setRef: (node: THREE.Group | null) => void
}) {
  const color = player.team === "user" ? "#38bdf8" : "#ef4444"

  return (
    <group ref={setRef} position={player.start}>
      <mesh position={[0, 0.7, 0]}>
        <capsuleGeometry args={[0.32, 0.9, 8, 16]} />
        <meshStandardMaterial color={controlled ? "#fde047" : color} />
      </mesh>

      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>

      <mesh position={[-0.22, 0.25, 0]}>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[0.22, 0.25, 0]}>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <Html position={[0, -0.25, 0]} center>
        <div className="whitespace-nowrap rounded-md bg-black/75 px-2 py-1 text-xs font-bold text-white">
          {player.name}
        </div>
      </Html>
    </group>
  )
}

function Goal({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[-GOAL_WIDTH / 2, 1, 0]}>
        <boxGeometry args={[0.18, 2, 0.18]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[GOAL_WIDTH / 2, 1, 0]}>
        <boxGeometry args={[0.18, 2, 0.18]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[GOAL_WIDTH, 0.18, 0.18]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 1, z > 0 ? 0.75 : -0.75]}>
        <boxGeometry args={[GOAL_WIDTH, 2, 0.05]} />
        <meshStandardMaterial color="white" transparent opacity={0.18} wireframe />
      </mesh>
    </group>
  )
}

function GameScene({
  players,
  controlledIndex,
  setControlledIndex,
  onScore,
}: {
  players: GamePlayer[]
  controlledIndex: number
  setControlledIndex: React.Dispatch<React.SetStateAction<number>>
  onScore: (side: Team) => void
}) {
  const playerRefs = useRef<(THREE.Group | null)[]>([])
  const velocities = useRef<THREE.Vector3[]>(players.map(() => new THREE.Vector3()))
  const ballRef = useRef<THREE.Mesh>(null)
  const ballVelocity = useRef(new THREE.Vector3())
  const possession = useRef<number | null>(null)
  const lastDir = useRef(new THREE.Vector3(0, 0, -1))
  const keys = useRef<Record<string, boolean>>({})
  const locks = useRef({ q: false, j: false, k: false, l: false })

  useEffect(() => {
    function down(e: KeyboardEvent) {
      keys.current[e.key.toLowerCase()] = true
    }

    function up(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      keys.current[key] = false

      if (key === "q" || key === "j" || key === "k" || key === "l") {
        locks.current[key] = false
      }
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)

    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  function resetPositions() {
    players.forEach((p, i) => {
      playerRefs.current[i]?.position.copy(p.start)
      velocities.current[i]?.set(0, 0, 0)
    })

    ballRef.current?.position.set(0, 0.25, 0)
    ballVelocity.current.set(0, 0, 0)
    possession.current = null
    lastDir.current.set(0, 0, -1)
  }

  function shoot(index: number) {
    if (possession.current !== index) return

    const p = players[index]
    possession.current = null

    const dir = lastDir.current.clone()
    if (dir.length() === 0) dir.set(0, 0, -1)

    const power = 0.8 + (p.stats.shooting / 99) * 0.95
    ballVelocity.current.copy(dir.normalize()).multiplyScalar(power)
  }

  function pass(index: number) {
    if (possession.current !== index) return

    const teammates = [0, 1, 2].filter((i) => i !== index)
    const from = playerRefs.current[index]
    if (!from) return

    const targetIndex =
      teammates.find((i) => playerRefs.current[i]) ?? teammates[0]

    const target = playerRefs.current[targetIndex]
    if (!target) return

    const p = players[index]
    const dir = new THREE.Vector3().subVectors(target.position, from.position).normalize()

    possession.current = null
    const power = 0.55 + (p.stats.passing / 99) * 0.45
    ballVelocity.current.copy(dir).multiplyScalar(power)
  }

  function tackle(index: number) {
    if (!ballRef.current) return

    const me = playerRefs.current[index]
    if (!me) return

    for (let i = 3; i < players.length; i++) {
      const ai = playerRefs.current[i]
      if (!ai) continue

      if (
        me.position.distanceTo(ai.position) < 1.15 ||
        me.position.distanceTo(ballRef.current.position) < 1
      ) {
        possession.current = index
        ballVelocity.current.set(0, 0, 0)
        return
      }
    }
  }

  useFrame(({ camera }) => {
    const ball = ballRef.current?.position
    const controlled = playerRefs.current[controlledIndex]
    const controlledPlayer = players[controlledIndex]

    if (!ball || !controlled || !controlledPlayer) return

    if (keys.current.q && !locks.current.q) {
      locks.current.q = true
      setControlledIndex((prev) => (prev + 1) % 3)
    }

    if (keys.current.j && !locks.current.j) {
      locks.current.j = true
      shoot(controlledIndex)
    }

    if (keys.current.l && !locks.current.l) {
      locks.current.l = true
      pass(controlledIndex)
    }

    if (keys.current.k && !locks.current.k) {
      locks.current.k = true
      tackle(controlledIndex)
    }

    let ix = 0
    let iz = 0

    if (keys.current.w) iz -= 1
    if (keys.current.s) iz += 1
    if (keys.current.a) ix -= 1
    if (keys.current.d) ix += 1

    const input = new THREE.Vector3(ix, 0, iz)
    if (input.length() > 0) {
      input.normalize()
      lastDir.current.copy(input)
    }

    const accel = 0.012 + (controlledPlayer.stats.dribbling / 99) * 0.012
    const maxSpeed = 0.1 + (controlledPlayer.stats.pace / 99) * 0.16

    velocities.current[controlledIndex].add(input.multiplyScalar(accel))

    if (velocities.current[controlledIndex].length() > maxSpeed) {
      velocities.current[controlledIndex].setLength(maxSpeed)
    }

    velocities.current[controlledIndex].multiplyScalar(0.91)
    controlled.position.add(velocities.current[controlledIndex])

    controlled.position.x = THREE.MathUtils.clamp(controlled.position.x, -FIELD_W / 2 + 1, FIELD_W / 2 - 1)
    controlled.position.z = THREE.MathUtils.clamp(controlled.position.z, -FIELD_H / 2 + 1, FIELD_H / 2 - 1)

    for (let i = 0; i < 3; i++) {
      if (i === controlledIndex) continue

      const tm = playerRefs.current[i]
      if (!tm) continue

      const home = players[i].start.clone()
      home.z -= 2

      const dir = new THREE.Vector3().subVectors(home, tm.position)
      if (dir.length() > 0.3) {
        dir.normalize()
        velocities.current[i].add(dir.multiplyScalar(0.006))
      }

      velocities.current[i].multiplyScalar(0.9)
      tm.position.add(velocities.current[i])
    }

    for (let i = 3; i < players.length; i++) {
      const ai = playerRefs.current[i]
      if (!ai) continue

      let target = ball

      if (possession.current !== null && possession.current < 3) {
        const holder = playerRefs.current[possession.current]
        if (holder) target = holder.position
      } else if (possession.current !== null && possession.current >= 3) {
        target = new THREE.Vector3(players[i].start.x, 0, players[i].start.z)
      }

      const dir = new THREE.Vector3().subVectors(target, ai.position)

      if (dir.length() > 0.25) {
        dir.normalize()
        const aiSpeed = 0.055 + (players[i].stats.pace / 99) * 0.065
        velocities.current[i].add(dir.multiplyScalar(0.01))
        if (velocities.current[i].length() > aiSpeed) velocities.current[i].setLength(aiSpeed)
      }

      velocities.current[i].multiplyScalar(0.9)
      ai.position.add(velocities.current[i])

      ai.position.x = THREE.MathUtils.clamp(ai.position.x, -FIELD_W / 2 + 1, FIELD_W / 2 - 1)
      ai.position.z = THREE.MathUtils.clamp(ai.position.z, -FIELD_H / 2 + 1, FIELD_H / 2 - 1)

      if (ai.position.distanceTo(ball) < 0.75 && possession.current === null) {
        possession.current = i
      }

      if (
        possession.current !== null &&
        possession.current < 3 &&
        playerRefs.current[possession.current] &&
        ai.position.distanceTo(playerRefs.current[possession.current]!.position) < 0.85
      ) {
        possession.current = i
      }
    }

    if (possession.current === null) {
      for (let i = 0; i < players.length; i++) {
        const p = playerRefs.current[i]
        if (!p) continue

        if (p.position.distanceTo(ball) < 0.78) {
          possession.current = i
          ballVelocity.current.set(0, 0, 0)
          if (i < 3) setControlledIndex(i)
          break
        }
      }
    }

    if (possession.current !== null) {
      const holder = playerRefs.current[possession.current]

      if (holder) {
        let dir =
          possession.current < 3
            ? lastDir.current.clone()
            : new THREE.Vector3(0, 0, 1)

        if (dir.length() === 0) dir = new THREE.Vector3(0, 0, -1)

        if (possession.current >= 3) {
          holder.position.z += 0.045

          if (holder.position.z > 14) {
            possession.current = null
            ballVelocity.current.set(0, 0, 0.8)
          }
        }

        ball.x = holder.position.x + dir.x * 0.7
        ball.z = holder.position.z + dir.z * 0.7
        ball.y = 0.25
      }
    } else {
      ball.add(ballVelocity.current)
      ballVelocity.current.multiplyScalar(0.965)
    }

    ball.x = THREE.MathUtils.clamp(ball.x, -FIELD_W / 2 + 0.3, FIELD_W / 2 - 0.3)
    ball.z = THREE.MathUtils.clamp(ball.z, -FIELD_H / 2 + 0.3, FIELD_H / 2 - 0.3)

    if (ball.z < AI_GOAL_Z && Math.abs(ball.x) < GOAL_WIDTH / 2) {
      onScore("user")
      resetPositions()
    }

    if (ball.z > USER_GOAL_Z && Math.abs(ball.x) < GOAL_WIDTH / 2) {
      onScore("ai")
      resetPositions()
    }

    const cameraTarget = new THREE.Vector3(controlled.position.x, 13, controlled.position.z + 13)
    camera.position.lerp(cameraTarget, 0.08)
    camera.lookAt(controlled.position.x, 0, controlled.position.z - 4)
  })

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 12, 5]} intensity={1.3} />

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_W, FIELD_H]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>

      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_W - 2, FIELD_H - 2]} />
        <meshStandardMaterial color="#22c55e" wireframe />
      </mesh>

      <Goal z={AI_GOAL_Z} />
      <Goal z={USER_GOAL_Z} />

      {players.map((p, i) => (
        <PlayerModel
          key={`${p.id}-${i}`}
          player={p}
          controlled={i === controlledIndex}
          setRef={(node) => {
            playerRefs.current[i] = node
          }}
        />
      ))}

      <mesh ref={ballRef} position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </>
  )
}

export default function ArcadePage() {
  const players = useMemo(() => [...getUserAttackers(), ...makeAiDefenders()], [])
  const [controlledIndex, setControlledIndex] = useState(0)
  const [score, setScore] = useState({ user: 0, ai: 0 })

  function handleScore(side: Team) {
    setScore((prev) =>
      side === "user"
        ? { ...prev, user: prev.user + 1 }
        : { ...prev, ai: prev.ai + 1 }
    )
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute left-6 top-6 z-10 rounded-2xl bg-black/70 px-5 py-4 text-white">
        <div className="whitespace-nowrap text-xl font-black">
          Score: {score.user} - {score.ai}
        </div>

        <div className="mt-1 text-sm text-slate-300">
          WASD move • J shoot • K tackle • L pass • Q switch
        </div>

        <div className="mt-1 text-sm text-cyan-300">
          Controlling: {players[controlledIndex]?.name}
        </div>
      </div>

      <Link
        href="/"
        className="absolute right-6 top-6 z-10 rounded-2xl border border-white/10 bg-black/70 px-5 py-3 font-bold text-white hover:bg-white/10"
      >
        Main Menu
      </Link>

      <Canvas camera={{ position: [0, 13, 13], fov: 55 }}>
        <GameScene
          players={players}
          controlledIndex={controlledIndex}
          setControlledIndex={setControlledIndex}
          onScore={handleScore}
        />
      </Canvas>
    </main>
  )
}