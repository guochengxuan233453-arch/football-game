export type PlayerStats = {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number

  // 👇 NEW (optional so old players don’t break)
  diving?: number
  handling?: number
  kicking?: number
  reflexes?: number
  speed?: number
  positioning?: number
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
  stats?: PlayerStats
  inPacks?: boolean
  skill?: string
}

export type UserData = {
  coins: number
  packs?: {
    bronze?: number
    gold?: number
    elite?: number
  }
}

export type SquadData = {
  formation: string
  slots: Record<string, string | null>
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
const SQUAD_KEY = "football_squad"
const MARKET_KEY = "football_market"

function isBrowser() {
  return typeof window !== "undefined"
}

const defaultUserData: UserData = {
  coins: 5000,
  packs: {
    bronze: 0,
    gold: 0,
    elite: 0,
  },
}

export const emptySlotsForFormation: Record<string, string[]> = {
  "4-3-3": ["lw", "st", "rw", "cm1", "cm2", "cm3", "lb", "cb1", "cb2", "rb", "gk"],
  "4-4-2": ["lm", "st1", "st2", "rm", "cm1", "cm2", "lb", "cb1", "cb2", "rb", "gk"],
  "4-2-3-1": ["lw", "cam", "rw", "st", "cdm1", "cdm2", "lb", "cb1", "cb2", "rb", "gk"],
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

export function getUserData(): UserData {
  if (!isBrowser()) return defaultUserData

  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultUserData))
    return defaultUserData
  }

  try {
    const parsed = JSON.parse(raw) as UserData
    return {
      ...defaultUserData,
      ...parsed,
      packs: {
        ...defaultUserData.packs,
        ...(parsed.packs ?? {}),
      },
    }
  } catch {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultUserData))
    return defaultUserData
  }
}

export function saveUserData(data: UserData) {
  if (!isBrowser()) return
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      ...defaultUserData,
      ...data,
      packs: {
        ...defaultUserData.packs,
        ...(data.packs ?? {}),
      },
    })
  )
}

export function getInventory(): InventoryPlayer[] {
  if (!isBrowser()) return []

  const raw = localStorage.getItem(INVENTORY_KEY)
  if (!raw) {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify([]))
    return []
  }

  try {
    return JSON.parse(raw) as InventoryPlayer[]
  } catch {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify([]))
    return []
  }
}

export function saveInventory(players: InventoryPlayer[]) {
  if (!isBrowser()) return
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(players))
}

export function addPlayerToInventory(player: InventoryPlayer) {
  const inventory = getInventory()
  inventory.push(player)
  saveInventory(inventory)
}

export function removePlayerFromInventory(playerId: string) {
  const inventory = getInventory().filter((player) => player.id !== playerId)
  saveInventory(inventory)
}

export function getSquad(): SquadData {
  const defaultSquad = createEmptySquad()

  if (!isBrowser()) return defaultSquad

  const raw = localStorage.getItem(SQUAD_KEY)
  if (!raw) {
    localStorage.setItem(SQUAD_KEY, JSON.stringify(defaultSquad))
    return defaultSquad
  }

  try {
    const parsed = JSON.parse(raw) as SquadData
    const formation = parsed.formation || "4-3-3"
    const base = createEmptySquad(formation)

    return {
      formation,
      slots: {
        ...base.slots,
        ...(parsed.slots ?? {}),
      },
    }
  } catch {
    localStorage.setItem(SQUAD_KEY, JSON.stringify(defaultSquad))
    return defaultSquad
  }
}

export function saveSquad(squad: SquadData) {
  if (!isBrowser()) return
  localStorage.setItem(SQUAD_KEY, JSON.stringify(squad))
}

export function getMarketListings(): MarketListing[] {
  if (!isBrowser()) return []

  const raw = localStorage.getItem(MARKET_KEY)
  if (!raw) {
    localStorage.setItem(MARKET_KEY, JSON.stringify([]))
    return []
  }

  try {
    return JSON.parse(raw) as MarketListing[]
  } catch {
    localStorage.setItem(MARKET_KEY, JSON.stringify([]))
    return []
  }
}

export function saveMarketListings(listings: MarketListing[]) {
  if (!isBrowser()) return
  localStorage.setItem(MARKET_KEY, JSON.stringify(listings))
}

export function addMarketListing(listing: MarketListing) {
  const listings = getMarketListings()
  listings.push(listing)
  saveMarketListings(listings)
}

export function removeMarketListing(listingId: string) {
  const listings = getMarketListings().filter((listing) => listing.listingId !== listingId)
  saveMarketListings(listings)
}