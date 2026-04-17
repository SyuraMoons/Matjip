import { getKarmaInfo } from "@/lib/status";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const karmaInfo = await getKarmaInfo(address);

    return Response.json(karmaInfo);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read Karma tier";
    const status = message.includes("configured") ? 502 : 400;

    return Response.json({ error: message }, { status });
  }
}
