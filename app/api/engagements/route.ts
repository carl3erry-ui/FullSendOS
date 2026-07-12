import { GET as getProjects, POST as postProjects } from "../projects/route";

export async function GET() {
  return getProjects();
}

export async function POST(request: Request) {
  return postProjects(request);
}
