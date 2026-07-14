import { GET as getProjects, POST as postProjects } from "../projects/route";

export async function GET(request?: Request) {
  return getProjects(request);
}

export async function POST(request: Request) {
  return postProjects(request);
}
