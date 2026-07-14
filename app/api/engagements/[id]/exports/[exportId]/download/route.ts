import { GET as getProjectExportDownload } from "../../../../../projects/[id]/exports/[exportId]/download/route";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; exportId: string }> },
) {
  return getProjectExportDownload(request, context);
}
