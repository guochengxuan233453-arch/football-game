import type { InventoryPlayer } from "./storage"

export type BasePlayer = Omit<InventoryPlayer, "id"> & {
  inPacks?: boolean
}

export type PackType = "bronze" | "gold" | "elite"

export const players: BasePlayer[] = [
  {
    baseId: "haaland",
    name: "Haaland",
    rating: 91,
    position: "ST",
    nationFlag: "/flags/norway.png",
    clubLogo: "/clubs/man_city.svg",
    cardImage: "/cards/haaland.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "debruyne",
    name: "De Bruyne",
    rating: 90,
    position: "CM",
    nationFlag: "/flags/belgium.png",
    clubLogo: "/clubs/man_city.svg",
    cardImage: "/cards/debruyne.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "foden",
    name: "Foden",
    rating: 88,
    position: "RW",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/man_city.svg",
    cardImage: "/cards/foden.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "saka",
    name: "Saka",
    rating: 89,
    position: "RW",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/arsenal.svg",
    cardImage: "/cards/saka.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "rice",
    name: "Rice",
    rating: 87,
    position: "CM",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/arsenal.svg",
    cardImage: "/cards/rice.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "vandijk",
    name: "Van Dijk",
    rating: 89,
    position: "CB",
    nationFlag: "/flags/netherlands.png",
    clubLogo: "/clubs/liverpool.svg",
    cardImage: "/cards/vandijk.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "salah",
    name: "Salah",
    rating: 90,
    position: "RW",
    nationFlag: "/flags/egypt.svg",
    clubLogo: "/clubs/liverpool.svg",
    cardImage: "/cards/salah.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "palmer",
    name: "Palmer",
    rating: 86,
    position: "CAM",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/chelsea.svg",
    cardImage: "/cards/palmer.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "bruno",
    name: "Bruno Fernandes",
    rating: 86,
    position: "CAM",
    nationFlag: "/flags/portugal.svg",
    clubLogo: "/clubs/man_united.svg",
    cardImage: "/cards/bruno.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "bellingham",
    name: "Bellingham",
    rating: 90,
    position: "CM",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/Real_Madrid.svg",
    cardImage: "/cards/bellingham.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "vinicius",
    name: "Vinicius Jr",
    rating: 90,
    position: "LW",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/Real_Madrid.svg",
    cardImage: "/cards/vinicius.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "rodrygo",
    name: "Rodrygo",
    rating: 87,
    position: "RW",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/Real_Madrid.svg",
    cardImage: "/cards/rodrygo.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "lewandowski",
    name: "Lewandowski",
    rating: 89,
    position: "ST",
    nationFlag: "/flags/poland.svg",
    clubLogo: "/clubs/barcelona.svg",
    cardImage: "/cards/lewandowski.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "pedri",
    name: "Pedri",
    rating: 86,
    position: "CM",
    nationFlag: "/flags/spain.svg",
    clubLogo: "/clubs/barcelona.svg",
    cardImage: "/cards/pedri.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "kane",
    name: "Kane",
    rating: 90,
    position: "ST",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/bayern.svg",
    cardImage: "/cards/kane.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "musiala",
    name: "Musiala",
    rating: 88,
    position: "CAM",
    nationFlag: "/flags/germany.svg",
    clubLogo: "/clubs/bayern.svg",
    cardImage: "/cards/musiala.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "wirtz",
    name: "Wirtz",
    rating: 87,
    position: "CAM",
    nationFlag: "/flags/germany.svg",
    clubLogo: "/clubs/leverkusen.png",
    cardImage: "/cards/wirtz.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "lautaro",
    name: "Lautaro",
    rating: 89,
    position: "ST",
    nationFlag: "/flags/argentina.png",
    clubLogo: "/clubs/inter.png",
    cardImage: "/cards/lautaro.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "leao",
    name: "Leao",
    rating: 87,
    position: "LW",
    nationFlag: "/flags/portugal.png",
    clubLogo: "/clubs/milan.png",
    cardImage: "/cards/leao.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "mbappe",
    name: "Mbappe",
    rating: 91,
    position: "ST",
    nationFlag: "/flags/france.svg",
    clubLogo: "/clubs/psg.svg",
    cardImage: "/cards/mbappe.png",
    rarity: "gold",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "dembele",
    name: "Dembele",
    rating: 86,
    position: "RW",
    nationFlag: "/flags/france.svg",
    clubLogo: "/clubs/psg.svg",
    cardImage: "/cards/dembele.png",
    rarity: "gold",
    walkoutType: "normal",
    inPacks: true,
  },
  {
    baseId: "ronaldo_icon",
    name: "Ronaldo",
    rating: 94,
    position: "ST",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/ronaldo.png",
    rarity: "elite",
    walkoutType: "big",
    inPacks: true,
  },
  {
    baseId: "zidane_icon",
    name: "Zidane",
    rating: 94,
    position: "CAM",
    nationFlag: "/flags/france.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/zidane.png",
    rarity: "elite",
    walkoutType: "big",
    inPacks: true,

  },
  {
    baseId: "neymar",
    name: "Neymar",
    rating: 96,
    position: "CAM",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/santos.png",
    cardImage: "/cards/neymar_founder.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

  },
  {
    baseId: "neuer",
    name: "Neuer",
    rating: 96,
    position: "GK",
    nationFlag: "/flags/germany.svg",
    clubLogo: "/clubs/bayern.svg",
    cardImage: "/cards/neuer_era.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "bale",
    name: "Bale",
    rating: 97,
    position: "LB",
    nationFlag: "/flags/wales.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/bale_lb.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "kroos",
    name: "Kroos",
    rating: 95,
    position: "CM",
    nationFlag: "/flags/germany.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/kroos_era.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "pirlo",
    name: "Pirlo",
    rating: 96,
    position: "CM",
    nationFlag: "/flags/italy.png",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/pirlo_founder.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "campbell",
    name: "Campbell",
    rating: 95,
    position: "CB",
    nationFlag: "/flags/england.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/campbell_founder.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "cafu",
    name: "Cafu",
    rating: 97,
    position: "RB",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/cafu_carnival.jpg",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "gullit_95",
    name: "Gullit",
    rating: 95,
    position: "ST",
    nationFlag: "/flags/netherlands.png",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/gullit_95.jpg",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "vieira",
    name: "Vieira",
    rating: 95,
    position: "CDM",
    nationFlag: "/flags/france.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/vieira.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "r9_92",
    name: "Ronaldo",
    rating: 92,
    position: "ST",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/r9_92.png",
    rarity: "icon",
    walkoutType: "big",
    inPacks: true,

    
  },
  {
    baseId: "r9_100",
    name: "Ronaldo Nazário",
    rating: 100,
    position: "ST",
    nationFlag: "/flags/brazil.svg",
    clubLogo: "/clubs/icon.png",
    cardImage: "/cards/r9_100.png", // add this image
    rarity: "icon",
    walkoutType: "big",
    inPacks: false, // IMPORTANT → cannot be packed
    stats: {
      pace: 99,
      shooting: 99,
      passing: 92,
      dribbling: 99,
      defending: 45,
      physical: 95,
    },
  },


]

export const packs: Record<
  PackType,
  {
    name: string
    price: number
    odds: {
      gold: number
      elite: number
      icon: number
    }
  }
> = {
  bronze: {
    name: "icon pack",
    price: 100000,
    odds: {
      gold: 0,
      elite: 0,
      icon: 1,
    },
  },
  gold: {
    name: "Gold Pack",
    price: 10000,
    odds: {
      gold: 0.8,
      elite: 0.2,
      icon: 0,
    },
  },
  elite: {
    name: "Elite Pack",
    price: 20000,
    odds: {
      gold: 0.599,
      elite: 0.4,
      icon: 0.001,
    },
  },
}

export function rollRarity(packType: PackType): "gold" | "elite" | "icon" {
  const r = Math.random()
  const odds = packs[packType].odds

  if (r < odds.icon) return "icon"
  if (r < odds.icon + odds.elite) return "elite"
  return "gold"
}

export function getRandomPlayerForPack(packType: PackType): BasePlayer {
  const rarity = rollRarity(packType)
  const pool = players.filter((player) => player.rarity === rarity)

  if (pool.length === 0) {
    return players[0]
  }

  return pool[Math.floor(Math.random() * pool.length)]
}