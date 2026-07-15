import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataRoomPanel } from "../app/components/data-room-panel";
import { ProjectDashboard } from "../app/components/project-dashboard";
import { WorkProductViewer } from "../app/components/work-product-viewer";

test("DataRoomPanel renders default folder options when upload form is shown", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      ownerId: "client-ui-1",
      scope: "client",
      disableAutoLoad: true,
      initialShowUpload: true,
      initialFolders: [
        {
          id: "financials",
          name: "Financials",
          slug: "financials",
          category: "financials",
          sortOrder: 1,
          isSystem: true,
        },
        {
          id: "misc",
          name: "Miscellaneous",
          slug: "misc",
          category: "misc",
          sortOrder: 10,
          isSystem: true,
        },
      ],
      initialFiles: [],
    })
  );

  assert.match(html, /Financials/);
  assert.match(html, /Miscellaneous/);
  assert.match(html, /Upload File/);
});

test("DataRoomPanel renders empty state when no client/engagement-linked files exist", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      ownerId: "client-ui-2",
      scope: "client",
      disableAutoLoad: true,
      initialFiles: [],
      initialFolders: [
        {
          id: "misc",
          name: "Miscellaneous",
          slug: "misc",
          category: "misc",
          sortOrder: 10,
          isSystem: true,
        },
      ],
    })
  );

  assert.match(html, /No files in the Data Room yet\.|No files have been added/);
});

test("DataRoomPanel shows upload action affordance when panel is loaded", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      ownerId: "client-ui-upload",
      scope: "client",
      disableAutoLoad: true,
      initialFiles: [],
      initialFolders: [
        {
          id: "misc",
          name: "Miscellaneous",
          slug: "misc",
          category: "misc",
          sortOrder: 10,
          isSystem: true,
        },
      ],
    })
  );

  assert.match(html, /\+ Upload/);
});

test("DataRoomPanel engagement scope renders the same empty state guidance", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      ownerId: "eng-ui-empty",
      scope: "engagement",
      disableAutoLoad: true,
      initialFiles: [],
      initialFolders: [
        {
          id: "misc",
          name: "Miscellaneous",
          slug: "misc",
          category: "misc",
          sortOrder: 10,
          isSystem: true,
        },
      ],
    })
  );

  assert.match(html, /No files in the Data Room yet\.|No files have been added/);
});

test("DataRoomPanel renders processing controls and status metadata", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      ownerId: "eng-ui-3",
      scope: "engagement",
      disableAutoLoad: true,
      initialFolders: [
        {
          id: "misc",
          name: "Miscellaneous",
          slug: "misc",
          category: "misc",
          sortOrder: 10,
          isSystem: true,
        },
      ],
      initialFiles: [
        {
          id: "file-1",
          clientId: "client-1",
          folderId: "misc",
          name: "memo.txt",
          type: "document",
          mimeType: "text/plain",
          size: 128,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "tester",
          tags: ["memo"],
          engagementIds: ["ENG-UI-3"],
          isArchived: false,
          approvedForAgentUse: false,
          sensitive: false,
          storagePath: "/secret/path/should-not-render",
          textExtracted: "FULL_EXTRACTED_TEXT_SHOULD_NOT_RENDER",
        } as never,
      ],
    })
  );

  assert.match(html, /Process File/);
  assert.match(html, /Not Approved/);
  assert.doesNotMatch(html, /storagePath/);
  assert.doesNotMatch(html, /FULL_EXTRACTED_TEXT_SHOULD_NOT_RENDER/);
});

test("ProjectDashboard renders a visible Data Room entry point in the client workspace area", () => {
  const html = renderToStaticMarkup(React.createElement(ProjectDashboard));

  assert.match(html, /Client Command Center/);
  assert.match(html, /Data Room/);
  assert.match(html, /Human Input \/ Action Center/);
  assert.match(html, /Lifecycle visibility|Visibility filters/);
  assert.match(html, /Show archived/);
  assert.match(html, /Show deleted/);
  assert.match(html, /The Data Room is the source of truth for the AI Workforce|Upload.*documents.*improve output quality/i);;
});

test("WorkProductViewer renders a Data Room tab for engagement workspace access", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project: {
        id: "ENG-UI-4",
        companyName: "Hardware Brewery",
        objective: "Acquisition review",
        status: "needs-review",
        updatedAt: new Date().toISOString(),
        completedDepartments: 7,
        totalDepartments: 7,
      },
      detail: {
        id: "ENG-UI-4",
        status: "needs-review",
        departments: {},
        deliverables: {
          executiveReport: "Report",
          onePageSummary: "Summary",
          deckOutline: [],
        },
        audit: { runs: [], warnings: [] },
      },
      isLoading: false,
      loadError: null,
      activeSection: "data-room",
      onSectionChange: () => {},
      runningProjectId: null,
      onRun: () => {},
    })
  );

  assert.match(html, /Data Room/);
  assert.match(html, /Engagement Data Room/);
  assert.match(html, /Loading files\.\.\./);
});
