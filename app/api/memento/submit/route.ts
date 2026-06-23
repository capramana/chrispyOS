import { NextResponse } from "next/server";
import {
  createMementoEntry,
  type MementoSubmission,
} from "@/lib/supabase/memento";

function isSocialType(value: unknown): value is MementoSubmission["socialType"] {
  return value === "twitter" || value === "linkedin";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, socialType, socialHandle, message, drawing } = body as Record<
    string,
    unknown
  >;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (!isSocialType(socialType)) {
    return NextResponse.json({ error: "Invalid social type." }, { status: 400 });
  }

  if (typeof socialHandle !== "string" || !socialHandle.trim()) {
    return NextResponse.json({ error: "Social handle is required." }, { status: 400 });
  }

  if (typeof message !== "string") {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }

  if (typeof drawing !== "string" || !drawing.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "Invalid drawing." }, { status: 400 });
  }

  try {
    await createMementoEntry({
      name: name.trim(),
      socialType,
      socialHandle: socialHandle.trim(),
      message: message.trim(),
      drawing,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Memento submission failed:", error);
    return NextResponse.json(
      { error: "Could not save your entry. Try again in a moment." },
      { status: 500 },
    );
  }
}
