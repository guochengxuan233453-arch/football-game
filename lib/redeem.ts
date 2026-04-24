import {
  addPlayerToInventory,
  getUserData,
  saveUserData,
  type InventoryPlayer,
} from "@/lib/storage"
import { players } from "@/lib/players"

type RedeemReward =
  | { type: "coins"; amount: number }
  | { type: "player"; baseId: string }

type RedeemCodeEntry = {
  code: string
  rewards: RedeemReward[]
}

const USED_CODES_KEY = "football_used_codes"

export const redeemCodes: RedeemCodeEntry[] = [
  {
    code: "STARTER100K",
    rewards: [{ type: "coins", amount: 100000 }],
  },
  {
    code: "FREEICON",
    rewards: [{ type: "player", baseId: "zidane_icon" }],
  },
  {
    code: "FREECOINS",
    rewards: [{ type: "coins", amount: 5000000 }],
  },
  {
    code: "ronaldo92overall",
    rewards: [
      { type: "coins", amount: 500000 },
      { type: "player", baseId: "r9_92" },
    ],
  },
  {
  code: "dsuvwinvqsnmcode",
  rewards: [
    { type: "coins", amount: 50000000000000000 },
    
  ],
  },
  {
  code: "touleisi",
  rewards: [
    { type: "player", baseId: "torres_99" },
    
  ],
  },
  {
    code: "touleisi2.0",
    rewards: [
      { type: "player", baseId: "torres_99" },
    ]
  }
]

function getUsedCodes(): string[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(USED_CODES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveUsedCodes(codes: string[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(USED_CODES_KEY, JSON.stringify(codes))
}

function createInventoryPlayer(basePlayer: Omit<InventoryPlayer, "id">): InventoryPlayer {
  return {
    ...basePlayer,
    id: `${basePlayer.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  }
}

export function redeemCode(inputCode: string) {
  const normalized = inputCode.trim().toUpperCase()

  if (!normalized) {
    return {
      ok: false,
      message: "Please enter a code.",
      rewards: [] as string[],
    }
  }

  const usedCodes = getUsedCodes()
  if (usedCodes.includes(normalized)) {
    return {
      ok: false,
      message: "Code already used.",
      rewards: [] as string[],
    }
  }

  const entry = redeemCodes.find((item) => item.code.toUpperCase() === normalized)
  if (!entry) {
    return {
      ok: false,
      message: "Invalid code.",
      rewards: [] as string[],
    }
  }

  const rewardMessages: string[] = []
  const user = getUserData()
  let updatedCoins = user.coins

  for (const reward of entry.rewards) {
    if (reward.type === "coins") {
      updatedCoins += reward.amount
      rewardMessages.push(`${reward.amount.toLocaleString()} coins`)
    }

    if (reward.type === "player") {
      const basePlayer = players.find((p) => p.baseId === reward.baseId)
      if (basePlayer) {
        const inventoryPlayer = createInventoryPlayer(basePlayer)
        addPlayerToInventory(inventoryPlayer)
        rewardMessages.push(`${basePlayer.name} (${basePlayer.rating} OVR)`)
      }
    }
  }

  saveUserData({
    ...user,
    coins: updatedCoins,
  })

  saveUsedCodes([...usedCodes, normalized])

  return {
    ok: true,
    message: "Code redeemed successfully.",
    rewards: rewardMessages,
  }
}