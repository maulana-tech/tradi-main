import { NextRequest, NextResponse } from "next/server";

interface PriceData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
}

interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  marketCap: number;
  lastUpdated: string;
  chain: string;
  address: string | null;
  isCToken: boolean;
}

const C_TOKENS: Record<string, { address: string; underlying: string; chain: string }> = {
  cETH: { address: "0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d", underlying: "ethereum", chain: "Arbitrum Sepolia" },
  cUSDC: { address: "0x5269822fc0127A9531c6B63dF0227E463e8DC411", underlying: "usd-coin", chain: "Arbitrum Sepolia" },
};

// Cache prices for 30 seconds
let cachedPrices: MarketAsset[] | null = null;
let cacheTime = 0;

async function fetchPrices(): Promise<MarketAsset[]> {
  if (cachedPrices && Date.now() - cacheTime < 30000) return cachedPrices;

  try {
    const ids = Object.values(C_TOKENS).map((t) => t.underlying).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`,
      { next: { revalidate: 30 } }
    );

    if (!res.ok) {
      // Fallback to static prices if API fails
      return getFallbackPrices();
    }

    const data = (await res.json()) as PriceData[];

    const assets: MarketAsset[] = [];

    for (const coin of data) {
      // Find cToken that uses this underlying
      const cTokenEntry = Object.entries(C_TOKENS).find(([, v]) => v.underlying === coin.id);

      if (cTokenEntry) {
        const [symbol, info] = cTokenEntry;
        assets.push({
          symbol,
          name: symbol === "cETH" ? "Compound ETH" : "Compound USDC",
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          lastUpdated: coin.last_updated,
          chain: info.chain,
          address: info.address,
          isCToken: true,
        });
      }

      // Also add the underlying token
      assets.push({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        volume: coin.total_volume,
        marketCap: coin.market_cap,
        lastUpdated: coin.last_updated,
        chain: "Ethereum",
        address: null,
        isCToken: false,
      });
    }

    cachedPrices = assets;
    cacheTime = Date.now();
    return assets;
  } catch {
    return getFallbackPrices();
  }
}

function getFallbackPrices(): MarketAsset[] {
  return [
    { symbol: "ETH", name: "Ethereum", price: 3500, change24h: 2.5, high24h: 3550, low24h: 3420, volume: 15000000000, marketCap: 420000000000, lastUpdated: new Date().toISOString(), chain: "Ethereum", address: null, isCToken: false },
    { symbol: "cETH", name: "Compound ETH", price: 3500, change24h: 2.5, high24h: 3550, low24h: 3420, volume: 0, marketCap: 0, lastUpdated: new Date().toISOString(), chain: "Arbitrum Sepolia", address: "0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d", isCToken: true },
    { symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.01, high24h: 1.001, low24h: 0.999, volume: 8000000000, marketCap: 32000000000, lastUpdated: new Date().toISOString(), chain: "Ethereum", address: null, isCToken: false },
    { symbol: "cUSDC", name: "Compound USDC", price: 1.0, change24h: 0.01, high24h: 1.001, low24h: 0.999, volume: 0, marketCap: 0, lastUpdated: new Date().toISOString(), chain: "Arbitrum Sepolia", address: "0x5269822fc0127A9531c6B63dF0227E463e8DC411", isCToken: true },
  ];
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");

  const assets = await fetchPrices();

  if (symbol) {
    const asset = assets.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase());
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    return NextResponse.json({ asset });
  }

  return NextResponse.json({ assets, total: assets.length, cached: cachedPrices !== null });
}
