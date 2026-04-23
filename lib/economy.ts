import { InventoryPlayer } from "./storage"

export function getQuickSellPrice(player: InventoryPlayer): number {
  if (player.rarity === "gold") return 5000 + player.rating * 30
  if (player.rarity === "icon") return 58000 + player.rating * 340
  if (player.rarity === "elite") return 6000 + player.rating * 34
  return 1200 + player.rating * 45
}

export function getMarketBuyPrice(player: InventoryPlayer): number {
  if (player.rarity === "gold") return 4500 + player.rating * 71
  if (player.rarity === "icon") return 72000 + player.rating * 640
  if (player.rarity === "elite") return 5500 + player.rating * 83
  return 2000 + player.rating * 70
}

export function getSuggestedSellPrice(player: InventoryPlayer): number {
  const buy = getMarketBuyPrice(player)
  return Math.floor(buy * 0.9)
}