export type NameCard = {
  native: string;
  rToken: string;
  bitgetSymbols: string[];
  name: string;
  cik?: string;
  sector: string;
  aliases: string[];
};

export const UNIVERSE: NameCard[] = [
  {
    native: "AAPL",
    rToken: "rAAPL",
    bitgetSymbols: ["RAAPLUSDT", "AAPLUSDT", "AAPLXUSDT", "AAPLRTUSDT"],
    name: "Apple",
    cik: "0000320193",
    sector: "Technology",
    aliases: ["apple", "aapl rtoken", "aaplr"],
  },
  {
    native: "NVDA",
    rToken: "rNVDA",
    bitgetSymbols: ["RNVDAUSDT", "NVDAUSDT", "NVDAXUSDT", "NVDARTUSDT"],
    name: "NVIDIA",
    cik: "0001045810",
    sector: "Technology",
    aliases: ["nvidia", "nvda rtoken", "nvdar"],
  },
  {
    native: "TSLA",
    rToken: "rTSLA",
    bitgetSymbols: ["RTSLAUSDT", "TSLAUSDT", "TSLAXUSDT", "TSLARTUSDT"],
    name: "Tesla",
    cik: "0001318605",
    sector: "Consumer Discretionary",
    aliases: ["tesla", "tsla rtoken"],
  },
  {
    native: "MSFT",
    rToken: "rMSFT",
    bitgetSymbols: ["RMSFTUSDT", "MSFTUSDT", "MSFTXUSDT"],
    name: "Microsoft",
    cik: "0000789019",
    sector: "Technology",
    aliases: ["microsoft", "msft rtoken"],
  },
  {
    native: "AMZN",
    rToken: "rAMZN",
    bitgetSymbols: ["RAMZNUSDT", "AMZNUSDT", "AMZNXUSDT"],
    name: "Amazon",
    cik: "0001018723",
    sector: "Consumer Discretionary",
    aliases: ["amazon", "amzn rtoken"],
  },
  {
    native: "META",
    rToken: "rMETA",
    bitgetSymbols: ["RMETAUSDT", "METAUSDT", "METAXUSDT"],
    name: "Meta Platforms",
    cik: "0001326801",
    sector: "Communication Services",
    aliases: ["meta", "facebook", "meta rtoken"],
  },
  {
    native: "GOOGL",
    rToken: "rGOOGL",
    bitgetSymbols: ["RGOOGLUSDT", "GOOGLUSDT", "GOOGLXUSDT"],
    name: "Alphabet",
    cik: "0001652044",
    sector: "Communication Services",
    aliases: ["alphabet", "google", "googl rtoken"],
  },
  {
    native: "AMD",
    rToken: "rAMD",
    bitgetSymbols: ["RAMDUSDT", "AMDUSDT", "AMDXUSDT"],
    name: "AMD",
    cik: "0000002488",
    sector: "Technology",
    aliases: ["amd rtoken"],
  },
  {
    native: "AVGO",
    rToken: "rAVGO",
    bitgetSymbols: ["RAVGOUSDT", "AVGOUSDT", "AVGOXUSDT"],
    name: "Broadcom",
    cik: "0001730168",
    sector: "Technology",
    aliases: ["broadcom", "avgo rtoken"],
  },
  {
    native: "NFLX",
    rToken: "rNFLX",
    bitgetSymbols: ["RNFLXUSDT", "NFLXUSDT", "NFLXXUSDT"],
    name: "Netflix",
    cik: "0001065280",
    sector: "Communication Services",
    aliases: ["netflix", "nflx rtoken"],
  },
  {
    native: "COIN",
    rToken: "rCOIN",
    bitgetSymbols: ["RCOINUSDT", "COINUSDT", "COINXUSDT"],
    name: "Coinbase",
    cik: "0001679788",
    sector: "Financials",
    aliases: ["coinbase", "coin rtoken"],
  },
  {
    native: "PLTR",
    rToken: "rPLTR",
    bitgetSymbols: ["RPLTRUSDT", "PLTRUSDT", "PLTRXUSDT"],
    name: "Palantir",
    cik: "0001321655",
    sector: "Technology",
    aliases: ["palantir", "pltr rtoken"],
  },
];

export function findName(query: string): NameCard {
  const q = query.toLowerCase();
  const hit = UNIVERSE.find((n) => {
    if (q.includes(n.native.toLowerCase())) return true;
    if (q.includes(n.rToken.toLowerCase())) return true;
    return n.aliases.some((a) => q.includes(a));
  });
  return hit ?? UNIVERSE[0];
}

export function nameFromBitgetContract(contract: { symbol: string; baseCoin: string }): NameCard {
  const native = contract.baseCoin;
  const known = UNIVERSE.find((name) => name.native === native);
  if (known) {
    return { ...known, bitgetSymbols: [contract.symbol, ...known.bitgetSymbols.filter((symbol) => symbol !== contract.symbol)] };
  }
  return {
    native,
    rToken: `${native}r`,
    bitgetSymbols: [contract.symbol],
    name: native,
    sector: "Bitget RWA",
    aliases: [native.toLowerCase(), `${native.toLowerCase()}r`, `${native.toLowerCase()} rtoken`],
  };
}

export function nameFromBitgetRTokenMarket(market: { symbol: string; baseCoin: string }): NameCard {
  const native = market.baseCoin.slice(1).toUpperCase();
  const known = UNIVERSE.find((name) => name.native === native);
  if (known) {
    return {
      ...known,
      rToken: market.baseCoin,
      bitgetSymbols: [market.symbol, ...known.bitgetSymbols.filter((symbol) => symbol !== market.symbol)],
    };
  }
  return {
    native,
    rToken: market.baseCoin,
    bitgetSymbols: [market.symbol, `${native}USDT`],
    name: native,
    sector: "Bitget rToken",
    aliases: [native.toLowerCase(), market.baseCoin.toLowerCase(), `${native.toLowerCase()} rtoken`],
  };
}
