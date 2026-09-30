# Daily monday.com Board Export to Google Drive

**Owner:** Brad Youles  
**Status:** Active  
**Last reviewed:** 2026-09-30  

## Purpose

This Google Apps Script exports a monday.com board to Google Drive once per day. It creates a daily snapshot of project or task data that can later be reviewed, compared, analyzed, or used by another reporting workflow.

The script creates:

- a JSON snapshot containing the full board structure and item data
- a CSV snapshot for easy manual review
- a destination subfolder automatically if it does not already exist

It also includes parent items and subitems.

## What the script exports

Each daily snapshot includes:

- board name
- board columns
- board groups
- parent items
- subitems
- item names and IDs
- created and updated timestamps
- group membership
- column values
- human-readable column names

The CSV is flattened so that each parent item or subitem appears on its own row.

## Repository files

```text
Code.gs
README.md
```

## Requirements

You need:

- a monday.com account with API access
- a monday.com personal API token or another supported API token
- a Google account
- a Google Drive folder where snapshots should be stored
- a Google Apps Script project

## Security

Do **not** hard-code your monday.com API token in `Code.gs`.

This project uses Google Apps Script **Script Properties** for configuration.

The following values should be stored there:

| Property | Required | Description |
|---|---:|---|
| `MONDAY_API_TOKEN` | Yes | monday.com API token |
| `MONDAY_BOARD_ID` | Yes | Numeric monday.com board ID |
| `GOOGLE_DRIVE_PARENT_FOLDER_ID` | Yes | Google Drive folder ID where the export subfolder should live |
| `DAILY_FOLDER_NAME` | No | Name of the export folder. Defaults to `Daily MDC` |

Because these values are stored outside the source code, the repository can be committed to GitHub without exposing account-specific IDs or credentials.

## Set up the Google Apps Script project

1. Create a new Google Apps Script project.
2. Replace the contents of `Code.gs` with the `Code.gs` file from this repository.
3. Open **Project Settings**.
4. Scroll to **Script Properties**.
5. Add the required properties.

Example:

```text
MONDAY_API_TOKEN = your-token-here
MONDAY_BOARD_ID = 123456789
GOOGLE_DRIVE_PARENT_FOLDER_ID = abcdef123456
DAILY_FOLDER_NAME = Daily MDC
```

The values above are examples only.

## Finding the monday.com board ID

A monday.com board URL generally contains the numeric board ID.

For example:

```text
https://example.monday.com/boards/123456789/views/987654321
```

The board ID is:

```text
123456789
```

Do not commit your organization's actual board URL or token to a public repository.

## Finding the Google Drive folder ID

A Google Drive folder URL generally looks like:

```text
https://drive.google.com/drive/folders/abcdefghijklmnopqrstuvwxyz
```

The folder ID is the value after `/folders/`.

For example:

```text
abcdefghijklmnopqrstuvwxyz
```

Store that value as:

```text
GOOGLE_DRIVE_PARENT_FOLDER_ID
```

## First test

In Apps Script:

1. Select the function `exportMondayBoardDaily`.
2. Click **Run**.
3. Approve the requested Google permissions.
4. Open your configured Google Drive parent folder.
5. Confirm that the export subfolder was created.
6. Confirm that two files were created.

Example:

```text
Daily MDC/
├── Monday_Board_2026-09-21.json
└── Monday_Board_2026-09-21.csv
```

If the script is run multiple times on the same day, the existing files for that date are replaced instead of duplicated.

## Daily scheduling

The recommended setup is a Google Apps Script time-driven trigger.

### Option 1: Create the trigger manually

In Apps Script:

1. Open **Triggers**.
2. Click **Add Trigger**.
3. Choose:

```text
Function:
exportMondayBoardDaily

Event source:
Time-driven

Type:
Day timer

Time:
Choose an early-morning window
```

For example, you might run the export before a separate morning reporting or briefing process.

### Option 2: Create the trigger with code

Run:

```javascript
createDailyTrigger();
```

The included helper creates a daily trigger at approximately 6 AM in the Apps Script project's configured timezone.

Google Apps Script time-based triggers may run at some point within the selected hourly window rather than at an exact minute.

## Output files

### JSON

The JSON file preserves the richest representation of the board data.

Example structure:

```json
{
  "export_date": "2026-09-21",
  "exported_at": "2026-09-21T10:15:00.000Z",
  "board_id": "123456789",
  "board_name": "Example Project Board",
  "columns": [],
  "groups": [],
  "item_count": 25,
  "items": []
}
```

This format is recommended for downstream automation and analysis.

### CSV

The CSV contains one row per parent item or subitem.

The first columns are:

```text
Record Type
Parent Item ID
Parent Item Name
Item ID
Item Name
Group
Created At
Updated At
```

The remaining columns are generated dynamically from the board.

## Why both JSON and CSV?

The JSON file is useful for:

- automated analysis
- historical comparison
- preserving board structure
- preserving raw monday.com values
- AI-assisted reporting

The CSV file is useful for:

- opening in Excel or Google Sheets
- filtering tasks manually
- quickly checking deadlines and owners
- troubleshooting exports

## API pagination

monday.com board items are paginated.

The script retrieves:

1. the first `items_page`
2. its cursor
3. each subsequent `next_items_page`
4. all pages until the cursor is empty

This prevents the export from silently stopping after the first page of board items.

## Subitems

Subitems are retrieved with their parent items.

In the CSV:

- parent items use `Record Type = Parent`
- subitems use `Record Type = Subitem`
- subitems include their parent item ID and parent item name

This makes it easier to reconstruct task hierarchies during analysis.

## Troubleshooting

### Missing Script Properties

If you see:

```text
Missing required Script Properties
```

Open **Project Settings > Script Properties** and verify that these are present:

```text
MONDAY_API_TOKEN
MONDAY_BOARD_ID
GOOGLE_DRIVE_PARENT_FOLDER_ID
```

### monday.com API authentication error

Verify that:

- your token is current
- the token has access to the requested board
- there are no leading or trailing spaces in the Script Property

### Google Drive permission error

Make sure the Google account running the Apps Script has access to the configured parent folder.

### No board data returned

Confirm that:

- the board ID is correct
- the API token can access the board

### Duplicate files

The script intentionally deletes same-day files with the same filename before writing a new version.

This means rerunning the export produces:

```text
Monday_Board_YYYY-MM-DD.json
Monday_Board_YYYY-MM-DD.csv
```

rather than multiple copies.

## Recommended GitHub hygiene

Do not commit:

- API tokens
- real organization board URLs
- real board IDs if they are considered internal
- private Google Drive folder IDs if they are considered internal
- exported board snapshots containing internal project data

A `.gitignore` entry such as the following can help if exports are ever downloaded locally:

```gitignore
exports/
*.json
*.csv
```

Adjust this to your repository's needs.

## License

Add the license appropriate for your organization or project.

## Keywords

monday.com, Google Drive, Google Apps Script, board export, daily snapshot, JSON, CSV, project data, task data, API, automation, data export, subitems, pagination, Script Properties, reporting, archival, Brad
