# Bookmark Viewer Extension

Bookmark Viewer is a Manifest V3 browser extension for loading, searching, and exporting bookmarks from a compact popup UI.

Current extension version: **2.0.0**

<img width="444" height="602" alt="Bookmark Viewer screenshot" src="https://github.com/user-attachments/assets/acef0108-33e5-46c3-ba9f-ef7741f5f4e0" />

<img width="444" height="602" alt="Bookmark Viewer screenshot" src="https://github.com/user-attachments/assets/bcc316c5-b352-40e0-a211-6072ae5309f8" />

## What It Does

- Loads bookmarks directly from the browser bookmark tree.
- Imports bookmarks from `.html` and `.json` files.
- Searches bookmarks by title, URL, or folder.
- Exports the current list as a Netscape-compatible `bookmarks.html` file.
- Persists bookmarks in popup local storage so your last loaded list is restored.
- Shows total bookmark and folder counts.
- Supports light and dark theme toggle.
- Includes a background color wheel next to the theme toggle for custom popup colors.

## Tech Notes

- No build step is required.
- Uses `manifest_version: 3` with popup files:
	- `popup.html`
	- `popup.js`

## Install (Unpacked)

### Google Chrome

1. Clone or download this repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.

### Microsoft Edge

1. Clone or download this repository.
2. Open `edge://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.

## Usage

1. Click the Bookmark Viewer extension icon.
2. Load data using one of the following options:
	 - **Load Browser Bookmarks**
	 - **Upload Bookmark File** (`.html` or `.json`)
3. Use the search box to filter the list.
4. Click any bookmark to open it in a new tab.
5. Use **Export** to download the currently loaded list.
6. Use **Clear List** to reset the popup state.
7. Use the color wheel in the top-right to choose a custom background color (saved across popup sessions).

If no custom background color is selected, the popup keeps its default light/dark background based on the current theme.

## Permissions

- `bookmarks`: required to read bookmark data from the browser.

## Project Structure

- `manifest.json`: extension metadata and permissions.
- `popup.html`: popup markup and styling.
- `popup.js`: bookmark loading, parsing, filtering, persistence, and export logic.
- `icons/`: extension icons (`16`, `48`, `128`).

## License

This project is licensed under the MIT License. See `LICENSE` for details.
