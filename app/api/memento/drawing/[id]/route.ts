import { NextResponse } from "next/server";
import { getMementoDrawing } from "@/lib/supabase/memento";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const png = await getMementoDrawing(id);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (error) {
    console.error("Memento drawing fetch failed:", error);
    return NextResponse.json({ error: "Drawing not found." }, { status: 404 });
  }
}
