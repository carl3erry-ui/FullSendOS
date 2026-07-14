import { GET as getProjectDetail, PATCH as patchProjectDetail } from "../../projects/[id]/route";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getProjectDetail(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return patchProjectDetail(request, context);
}
