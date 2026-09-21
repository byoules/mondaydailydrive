/**
 * Daily Monday.com Board Export to Google Drive
 *
 * Exports a complete monday.com board snapshot to a Google Drive subfolder.
 * Creates both JSON and CSV files.
 *
 * GitHub-safe configuration:
 *   - MONDAY_API_TOKEN
 *   - MONDAY_BOARD_ID
 *   - GOOGLE_DRIVE_PARENT_FOLDER_ID
 *
 * Store these in Apps Script -> Project Settings -> Script Properties.
 *
 * Optional:
 *   - DAILY_FOLDER_NAME
 *
 * Default DAILY_FOLDER_NAME: "Daily MDC"
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';
const DEFAULT_DAILY_FOLDER_NAME = 'Daily MDC';


/**
 * Main function.
 *
 * Run this manually for testing and use this same function
 * for the daily Apps Script trigger.
 */
function exportMondayBoardDaily() {
  const config = getConfig_();

  console.log('Starting monday.com board export...');

  const dailyFolder = getOrCreateDailyFolder_(
    config.parentFolderId,
    config.dailyFolderName
  );

  const boardData = getEntireBoard_(config.boardId, config.apiToken);

  const now = new Date();
  const dateString = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );

  const snapshot = {
    export_date: dateString,
    exported_at: now.toISOString(),
    board_id: String(config.boardId),
    board_name: boardData.board.name,
    columns: boardData.board.columns,
    groups: boardData.board.groups,
    item_count: boardData.items.length,
    items: boardData.items
  };

  const jsonName = 'Monday_Board_' + dateString + '.json';
  replaceFileIfExists_(
    dailyFolder,
    jsonName,
    JSON.stringify(snapshot, null, 2),
    MimeType.PLAIN_TEXT
  );

  const csvName = 'Monday_Board_' + dateString + '.csv';
  replaceFileIfExists_(
    dailyFolder,
    csvName,
    makeFlatCsv_(snapshot),
    MimeType.CSV
  );

  console.log('Export complete.');
  console.log('JSON: ' + jsonName);
  console.log('CSV: ' + csvName);
  console.log('Parent items exported: ' + boardData.items.length);
}


/**
 * Reads configuration from Script Properties.
 */
function getConfig_() {
  const properties = PropertiesService.getScriptProperties();

  const apiToken = properties.getProperty('MONDAY_API_TOKEN');
  const boardId = properties.getProperty('MONDAY_BOARD_ID');
  const parentFolderId =
    properties.getProperty('GOOGLE_DRIVE_PARENT_FOLDER_ID');
  const dailyFolderName =
    properties.getProperty('DAILY_FOLDER_NAME') ||
    DEFAULT_DAILY_FOLDER_NAME;

  const missing = [];

  if (!apiToken) {
    missing.push('MONDAY_API_TOKEN');
  }

  if (!boardId) {
    missing.push('MONDAY_BOARD_ID');
  }

  if (!parentFolderId) {
    missing.push('GOOGLE_DRIVE_PARENT_FOLDER_ID');
  }

  if (missing.length > 0) {
    throw new Error(
      'Missing required Script Properties: ' + missing.join(', ')
    );
  }

  return {
    apiToken: apiToken,
    boardId: String(boardId),
    parentFolderId: parentFolderId,
    dailyFolderName: dailyFolderName
  };
}


/**
 * Retrieves the board schema and all parent items.
 *
 * monday.com items_page is paginated, so additional pages
 * are fetched until no cursor remains.
 */
function getEntireBoard_(boardId, apiToken) {
  const initialQuery = `
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        id
        name

        columns {
          id
          title
          type
          settings_str
        }

        groups {
          id
          title
        }

        items_page(limit: 500) {
          cursor

          items {
            id
            name
            created_at
            updated_at

            group {
              id
              title
            }

            column_values {
              id
              type
              text
              value

              column {
                title
              }
            }

            subitems {
              id
              name
              created_at
              updated_at

              column_values {
                id
                type
                text
                value

                column {
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  const first = mondayRequest_(
    initialQuery,
    { boardId: [String(boardId)] },
    apiToken
  );

  if (
    !first.data ||
    !first.data.boards ||
    !first.data.boards.length
  ) {
    throw new Error(
      'No board data was returned for board ID ' + boardId
    );
  }

  const board = first.data.boards[0];

  let allItems = board.items_page.items || [];
  let cursor = board.items_page.cursor;

  console.log(
    'Retrieved first page: ' + allItems.length + ' parent items'
  );

  while (cursor) {
    const nextQuery = `
      query ($cursor: String!) {
        next_items_page(
          limit: 500,
          cursor: $cursor
        ) {
          cursor

          items {
            id
            name
            created_at
            updated_at

            group {
              id
              title
            }

            column_values {
              id
              type
              text
              value

              column {
                title
              }
            }

            subitems {
              id
              name
              created_at
              updated_at

              column_values {
                id
                type
                text
                value

                column {
                  title
                }
              }
            }
          }
        }
      }
    `;

    const next = mondayRequest_(
      nextQuery,
      { cursor: cursor },
      apiToken
    );

    const page = next.data.next_items_page;

    allItems = allItems.concat(page.items || []);
    cursor = page.cursor;

    console.log(
      'Retrieved ' + allItems.length + ' parent items so far...'
    );
  }

  return {
    board: board,
    items: allItems
  };
}


/**
 * Sends a GraphQL request to monday.com.
 */
function mondayRequest_(query, variables, apiToken) {
  const response = UrlFetchApp.fetch(
    MONDAY_API_URL,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: apiToken
      },
      payload: JSON.stringify({
        query: query,
        variables: variables || {}
      }),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'monday.com API HTTP error ' + status + ':\n' + body
    );
  }

  const result = JSON.parse(body);

  if (result.errors && result.errors.length) {
    throw new Error(
      'monday.com API error:\n' +
      JSON.stringify(result.errors, null, 2)
    );
  }

  return result;
}


/**
 * Finds or creates the configured daily export folder.
 */
function getOrCreateDailyFolder_(parentFolderId, folderName) {
  const parent = DriveApp.getFolderById(parentFolderId);
  const matches = parent.getFoldersByName(folderName);

  if (matches.hasNext()) {
    return matches.next();
  }

  console.log(
    'Folder "' + folderName + '" not found. Creating it...'
  );

  return parent.createFolder(folderName);
}


/**
 * Replaces a same-day export rather than creating duplicates.
 */
function replaceFileIfExists_(folder, filename, content, mimeType) {
  const files = folder.getFilesByName(filename);

  while (files.hasNext()) {
    files.next().setTrashed(true);
  }

  folder.createFile(filename, content, mimeType);
}


/**
 * Creates a flat CSV with one row per parent item or subitem.
 *
 * Column headers are built dynamically from the monday.com data.
 */
function makeFlatCsv_(snapshot) {
  const rows = [];
  const columnMap = {};

  snapshot.items.forEach(function(item) {
    collectColumnNames_(item, columnMap);

    (item.subitems || []).forEach(function(subitem) {
      collectColumnNames_(subitem, columnMap);
    });
  });

  const columnIds = Object.keys(columnMap);

  const headers = [
    'Record Type',
    'Parent Item ID',
    'Parent Item Name',
    'Item ID',
    'Item Name',
    'Group',
    'Created At',
    'Updated At'
  ];

  columnIds.forEach(function(id) {
    headers.push(columnMap[id]);
  });

  rows.push(headers);

  snapshot.items.forEach(function(item) {
    rows.push(
      itemToCsvRow_(
        item,
        null,
        columnIds,
        'Parent'
      )
    );

    (item.subitems || []).forEach(function(subitem) {
      rows.push(
        itemToCsvRow_(
          subitem,
          item,
          columnIds,
          'Subitem'
        )
      );
    });
  });

  return rows
    .map(function(row) {
      return row.map(csvEscape_).join(',');
    })
    .join('\n');
}


/**
 * Collects monday.com column IDs and human-readable titles.
 */
function collectColumnNames_(item, columnMap) {
  (item.column_values || []).forEach(function(cv) {
    columnMap[cv.id] =
      cv.column && cv.column.title
        ? cv.column.title
        : cv.id;
  });
}


/**
 * Converts a monday.com item into a flat CSV row.
 */
function itemToCsvRow_(item, parent, columnIds, recordType) {
  const valueMap = {};

  (item.column_values || []).forEach(function(cv) {
    let value = cv.text;

    if (
      (value === null ||
       value === undefined ||
       value === '') &&
      cv.value
    ) {
      value = cv.value;
    }

    valueMap[cv.id] = value || '';
  });

  const row = [
    recordType,
    parent ? parent.id : '',
    parent ? parent.name : '',
    item.id || '',
    item.name || '',
    item.group ? item.group.title : '',
    item.created_at || '',
    item.updated_at || ''
  ];

  columnIds.forEach(function(id) {
    row.push(valueMap[id] || '');
  });

  return row;
}


/**
 * Escapes one CSV field.
 */
function csvEscape_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);

  if (
    text.indexOf(',') >= 0 ||
    text.indexOf('"') >= 0 ||
    text.indexOf('\n') >= 0
  ) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}


/**
 * Optional helper.
 *
 * Creates a daily trigger for approximately 6 AM in the
 * Apps Script project's configured timezone.
 *
 * You may instead create the trigger manually in the
 * Apps Script UI.
 */
function createDailyTrigger() {
  ScriptApp
    .getProjectTriggers()
    .forEach(function(trigger) {
      if (
        trigger.getHandlerFunction() ===
        'exportMondayBoardDaily'
      ) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

  ScriptApp
    .newTrigger('exportMondayBoardDaily')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  console.log('Daily trigger created.');
}
