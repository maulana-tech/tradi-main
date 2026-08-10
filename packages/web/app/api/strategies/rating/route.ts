import { NextRequest, NextResponse } from "next/server";

interface Rating {
  strategyId: string;
  rating: number;
  count: number;
}

const globalForRatings = globalThis as unknown as {
  ratingStore: Map<string, Rating> | undefined;
};

const store: Map<string, Rating> =
  globalForRatings.ratingStore ?? new Map();
globalForRatings.ratingStore = store;

export async function GET(request: NextRequest) {
  const strategyId = request.nextUrl.searchParams.get("strategyId");

  if (strategyId) {
    const rating = store.get(strategyId);
    return NextResponse.json({
      strategyId,
      rating: rating?.rating ?? 0,
      count: rating?.count ?? 0,
    });
  }

  const ratings = Array.from(store.values());
  return NextResponse.json({ ratings });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    strategyId: string;
    rating: number;
  };

  if (!body.strategyId || !body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: "strategyId and rating (1-5) required" }, { status: 400 });
  }

  const existing = store.get(body.strategyId);
  if (existing) {
    const total = existing.rating * existing.count + body.rating;
    existing.count += 1;
    existing.rating = Math.round((total / existing.count) * 10) / 10;
    store.set(body.strategyId, existing);
  } else {
    store.set(body.strategyId, {
      strategyId: body.strategyId,
      rating: body.rating,
      count: 1,
    });
  }

  return NextResponse.json({ ok: true, rating: store.get(body.strategyId) });
}
