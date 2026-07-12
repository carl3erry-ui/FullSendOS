import { GET as getProjectDetail } from "../../projects/[id]/route";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getProjectDetail(request, context);
}
