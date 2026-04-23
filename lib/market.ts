import { players } from "./players"
import {
  getMarketListings,
  saveMarketListings,
  type InventoryPlayer,
  type MarketListing,
} from "./storage"

const MARKET_REFRESH_MS = 5 * 60 * 1000
const TARGET_AI_LISTINGS = 12

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getQuickSellPrice(player: InventoryPlayer) {
  if (player.rarity === "icon") return randomBetween(190000, 230000)
  if (player.rarity === "elite") return randomBetween(30000, 43000)
  return randomBetween(11000, 23000)
}

export { getQuickSellPrice }

export function getSuggestedSellPrice(player: InventoryPlayer) {
  if (player.rarity === "icon") return randomBetween(190000, 230000)
  if (player.rarity === "elite") return randomBetween(30000, 43000)
  return randomBetween(11000, 23000)
}

export function getMarketBuyPrice(player: InventoryPlayer) {
  if (player.rarity === "icon") return randomBetween(190000, 230000)
  if (player.rarity === "elite") return randomBetween(30000, 43000)
  return randomBetween(11000, 23000)
}

function getRandomRarity(): "gold" | "elite" | "icon" {
  const roll = Math.random()

  if (roll < 0.01) return "icon"
  if (roll < 0.11) return "elite"
  return "gold"
}

function makeAI(base: Omit<InventoryPlayer, "id">): InventoryPlayer {
  return {
    ...base,
    id: `${base.baseId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  }
}

function createListing(base: Omit<InventoryPlayer, "id">): MarketListing {
  const now = Date.now()
  const player = makeAI(base)

  return {
    listingId: player.id,
    player,
    price: getMarketBuyPrice(player),
    listedAt: now,
    expiresAt: now + MARKET_REFRESH_MS,
    sellerType: "ai",
  }
}

export function refreshAiMarket() {
  const now = Date.now()

  let listings = getMarketListings().filter(
    (listing) => listing.sellerType === "user" || listing.expiresAt > now
  )

  const aiListings = listings.filter((listing) => listing.sellerType === "ai")

  if (aiListings.length < TARGET_AI_LISTINGS) {
    const packPool = players.filter((p) => p.inPacks !== false)

    const goldPool = packPool.filter((p) => p.rarity === "gold")
    const elitePool = packPool.filter((p) => p.rarity === "elite")
    const iconPool = packPool.filter((p) => p.rarity === "icon")

    const missing = TARGET_AI_LISTINGS - aiListings.length

    for (let i = 0; i < missing; i++) {
      const rarity = getRandomRarity()

      let chosenPool: Omit<InventoryPlayer, "id">[] = goldPool

      if (rarity === "icon" && iconPool.length > 0) {
        chosenPool = iconPool
      } else if (rarity === "elite" && elitePool.length > 0) {
        chosenPool = elitePool
      }

      const randomPlayer =
        chosenPool[Math.floor(Math.random() * chosenPool.length)]

      if (randomPlayer) {
        listings.push(createListing(randomPlayer))
      }
    }
  }

  saveMarketListings(listings)
  return listings
}