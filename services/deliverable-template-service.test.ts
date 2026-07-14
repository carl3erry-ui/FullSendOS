import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultDeliverableTemplate,
  listDeliverableTemplates,
  resolveDeliverableTemplate,
} from "./deliverable-template-service";

test("listDeliverableTemplates returns built-in templates", () => {
  const templates = listDeliverableTemplates();

  assert.equal(Array.isArray(templates), true);
  assert.ok(templates.some((template) => template.id === "executive-standard"));
  assert.ok(templates.some((template) => template.id === "client-ready"));
  assert.ok(templates.some((template) => template.id === "investor-brief"));
  assert.ok(templates.some((template) => template.id === "internal-review"));
});

test("default template resolves to executive-standard", () => {
  const template = getDefaultDeliverableTemplate();
  assert.equal(template.id, "executive-standard");
});

test("resolveDeliverableTemplate returns default when templateId omitted", () => {
  const template = resolveDeliverableTemplate(undefined, "markdown");
  assert.ok(template);
  assert.equal(template?.id, "executive-standard");
});

test("resolveDeliverableTemplate resolves explicit template id", () => {
  const template = resolveDeliverableTemplate("client-ready", "markdown");
  assert.ok(template);
  assert.equal(template?.id, "client-ready");
});
