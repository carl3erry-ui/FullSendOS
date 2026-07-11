import { createEmptyProject, ProjectSchema } from "./schemas/projectSchema.js";

const project = createEmptyProject({
  companyName: "Roaring Pines Motor Club",
  objective: "Create a client-ready market and growth strategy.",
  geography: ["Florida"],
  knownFacts: ["The company name was supplied by the client."],
  sources: [{
    id: "SRC-001",
    title: "Client brief",
    sourceType: "client-provided",
    notes: "Initial project information supplied directly by the client."
  }]
});

ProjectSchema.parse(project);
console.log("Schema self-test passed:", project.id);
