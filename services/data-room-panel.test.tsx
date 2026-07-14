import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataRoomPanel } from "../app/components/data-room-panel";

test("DataRoomPanel renders default folder options when upload form is shown", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      engagementId: "ENG-UI-1",
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

  assert.match(html, /<option value="financials">Financials<\/option>/);
  assert.match(html, /<option value="misc">Miscellaneous<\/option>/);
});

test("DataRoomPanel renders empty state when no client/engagement-linked files exist", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      engagementId: "ENG-UI-2",
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

  assert.match(html, /No files uploaded yet/);
});

test("DataRoomPanel renders processing controls and status metadata", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataRoomPanel, {
      engagementId: "ENG-UI-3",
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
        },
      ],
    })
  );

  assert.match(html, /Process File/);
  assert.match(html, /Not Approved/);
});
