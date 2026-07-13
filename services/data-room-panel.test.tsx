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
