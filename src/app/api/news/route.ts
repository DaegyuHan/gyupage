import { NextResponse } from "next/server";
import { getNews } from "@/lib/news";

export async function GET() {
  return NextResponse.json({ topics: await getNews() });
}
