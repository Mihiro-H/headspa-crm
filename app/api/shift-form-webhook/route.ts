import { NextResponse } from "next/server";
import {
  processShiftFormSubmission,
  type ShiftFormSubmission,
} from "@/lib/scheduling/process-shift-form-submission";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SHIFT_FORM_WEBHOOK_SECRET}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const submission = (await request.json()) as ShiftFormSubmission;
  const result = await processShiftFormSubmission(submission);

  if (result.status === "unmatched_staff") {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
