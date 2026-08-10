import { NextResponse } from "next/server";
import { STRATEGIES, getStrategy } from "@/lib/strategies";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const category = searchParams.get("category");

  if (id) {
    const strategy = getStrategy(id);
    if (!strategy) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }
    return NextResponse.json({ strategy });
  }

  let strategies = STRATEGIES;
  if (category) {
    strategies = strategies.filter((s) => s.category === category);
  }

  return NextResponse.json({ strategies, total: strategies.length });
}
