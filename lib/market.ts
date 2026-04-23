import {
  getInventory,
  getMarketListings,
  saveInventory,
  saveMarketListings,
  type InventoryPlayer,
  type MarketListing,
} from "@/lib/storage"
import { getRandomPlayerForPack } from "@/lib/players"

const AI_MARKET_REFRESH_MS = 5 * 60 * 1000
const AI_MARKET_SIZE = 8

export function getQuickSellPrice(player: InventoryPlayer): number {
  if (player.rarity === "icon") return 90000
  if (player.rarity === "elite") return 19000
  return 9000
}

export function getMarketBuyPrice(player: InventoryPlayer): number {
  if (player.rarity === "icon") return 243000
  if (player.rarity === "elite") return 31000
  return 19000
}

function getAiExpiryTime(rarity: InventoryPlayer["rarity"]) {
  if (rarity === "icon") return 5 * 60 * 1000
  if (rarity === "elite") return 60 * 1000
  return 15 * 1000
}

function makeAiListing(player: InventoryPlayer): MarketListing {
  const now = Date.now()

  return {
    listingId: `ai-${player.id}-${now}-${Math.floor(Math.random() * 100000)}`,
    player,
    price: getMarketBuyPrice(player),
    listedAt: now,
    expiresAt: now + getAiExpiryTime(player.rarity),
    sellerType: "ai",
  }
}

function makeInventoryCardFromBasePlayer(basePlayer: any): InventoryPlayer {
  return {
    id: `${basePlayer.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    baseId: basePlayer.baseId,
    name: basePlayer.name,
    rating: basePlayer.rating,
    position: basePlayer.position,
    altPositions: basePlayer.altPositions ?? [],
    nationFlag: basePlayer.nationFlag,
    clubLogo: basePlayer.clubLogo,
    cardImage: basePlayer.cardImage,
    rarity: basePlayer.rarity,
    walkoutType: basePlayer.walkoutType,
    skill: basePlayer.skill,
    stats: basePlayer.stats,
    inPacks: basePlayer.inPacks,
  }
}

function makeAiPlayer(): InventoryPlayer {
  const packRoll = Math.random()

  let packType: "bronze" | "gold" | "elite" = "bronze"

  if (packRoll < 0.01) {
    packType = "elite"
  } else if (packRoll < 0.11) {
    packType = "gold"
  } else {
    packType = "bronze"
  }

  const basePlayer = getRandomPlayerForPack(packType)
  return makeInventoryCardFromBasePlayer(basePlayer)
}

export function refreshAiMarket(): MarketListing[] {
  const now = Date.now()
  const current = getMarketListings()

  const validAiListings = current.filter(
    (listing) => listing.sellerType === "ai" && listing.expiresAt > now
  )

  let listings = [...validAiListings]

  while (listings.length < AI_MARKET_SIZE) {
    listings.push(makeAiListing(makeAiPlayer()))
  }

  saveMarketListings(listings)
  return listings
}

export function buyAiMarketPlayer(listingId: string): MarketListing[] {
  const listings = getMarketListings()
  const updated = listings.filter((listing) => listing.listingId !== listingId)
  saveMarketListings(updated)
  return updated
}

export function quickSellPlayer(playerId: string): InventoryPlayer[] {
  const inventory = getInventory().filter((player) => player.id !== playerId)
  saveInventory(inventory)
  return inventory
}