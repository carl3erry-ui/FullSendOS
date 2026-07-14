import { GET as getProjectExportDetail } from "../../../../projects/[id]/exports/[exportId]/route";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; exportId: string }> },
) {
  return getProjectExportDetail(request, context);
}
