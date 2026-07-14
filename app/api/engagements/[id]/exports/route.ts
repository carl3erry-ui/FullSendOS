import { GET as getProjectExports, POST as postProjectExports } from "../../../projects/[id]/exports/route";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getProjectExports(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postProjectExports(request, context);
}
