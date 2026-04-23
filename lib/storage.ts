export type PlayerStats = {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

export type InventoryPlayer = {
  id: string
  baseId: string
  name: string
  rating: number
  position: string
  altPositions?: string[]
  nationFlag: string
  clubLogo: string
  cardImage: string
  rarity: "gold" | "elite" | "icon"
  walkoutType: "normal" | "big"
  stats?: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
  }
  inPacks?: boolean
}


export type UserData = {
  coins: number
}

export type MarketListing = {
  listingId: string
  player: InventoryPlayer
  price: number
  listedAt: number
  expiresAt: number
  sellerType: "user" | "ai"
}

const USER_KEY = "football_user"
const INVENTORY_KEY = "football_inventory"
const MARKET_KEY = "football_market"

export function getUserData(): UserData {
  if (typeof window === "undefined") return { coins: 200000 }

  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    const def = { coins: 200000 }
    localStorage.setItem(USER_KEY, JSON.stringify(def))
    return def
  }

  return JSON.parse(raw)
}

export function saveUserData(data: UserData) {
  localStorage.setItem(USER_KEY, JSON.stringify(data))
}

export function getInventory(): InventoryPlayer[] {
  if (typeof window === "undefined") return []

  const raw = localStorage.getItem(INVENTORY_KEY)
  if (!raw) return []

  return JSON.parse(raw)
}

export function saveInventory(players: InventoryPlayer[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(players))
}

export function removePlayerFromInventory(id: string) {
  const inv = getInventory().filter((p) => p.id !== id)
  saveInventory(inv)
}

export function getMarketListings(): MarketListing[] {
  const raw = localStorage.getItem(MARKET_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export function saveMarketListings(listings: MarketListing[]) {
  localStorage.setItem(MARKET_KEY, JSON.stringify(listings))
}

export function addMarketListing(listing: MarketListing) {
  const list = getMarketListings()
  list.push(listing)
  saveMarketListings(list)
}

export function removeMarketListing(id: string) {
  const list = getMarketListings().filter((l) => l.listingId !== id)
  saveMarketListings(list)
}

export function addPlayerToInventory(player: InventoryPlayer) {
  const inventory = getInventory()
  inventory.push(player)
  saveInventory(inventory)
}

export type SquadData = {
  formation: string
  slots: Record<string, string | null>
}

const SQUAD_KEY = "football_squad"

export const emptySlotsForFormation: Record<string, string[]> = {
  "4-3-3": ["lw", "st", "rw", "cm1", "cm2", "cm3", "lb", "cb1", "cb2", "rb", "gk"],
  "4-4-2": ["st1", "st2", "lm", "cm1", "cm2", "rm", "lb", "cb1", "cb2", "rb", "gk"],
  "4-2-3-1": ["st", "cam", "lw", "rw", "cdm1", "cdm2", "lb", "cb1", "cb2", "rb", "gk"],
}

export function getFormationSlots(formation: string): string[] {
  return emptySlotsForFormation[formation] ?? emptySlotsForFormation["4-3-3"]
}

export function createEmptySquad(formation = "4-3-3"): SquadData {
  const slots: Record<string, string | null> = {}

  for (const slot of getFormationSlots(formation)) {
    slots[slot] = null
  }

  return {
    formation,
    slots,
  }
}

export function getSquad(): SquadData {
  if (typeof window === "undefined") return createEmptySquad()

  const raw = localStorage.getItem(SQUAD_KEY)
  if (!raw) {
    const def = createEmptySquad()
    localStorage.setItem(SQUAD_KEY, JSON.stringify(def))
    return def
  }

  try {
    const parsed = JSON.parse(raw) as SquadData

    if (!parsed.formation || !parsed.slots) {
      const def = createEmptySquad()
      localStorage.setItem(SQUAD_KEY, JSON.stringify(def))
      return def
    }

    return parsed
  } catch {
    const def = createEmptySquad()
    localStorage.setItem(SQUAD_KEY, JSON.stringify(def))
    return def
  }
}

export function saveSquad(squad: SquadData) {
  if (typeof window === "undefined") return
  localStorage.setItem(SQUAD_KEY, JSON.stringify(squad))
}