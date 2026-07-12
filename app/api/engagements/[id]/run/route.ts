import { POST as postProjectRun } from "../../../projects/[id]/run/route";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postProjectRun(request, context);
}
