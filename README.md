# Bookmark Viewer Extension

Bookmark Viewer is a Manifest V3 browser extension for loading, searching, and exporting bookmarks from a compact popup UI.

Current extension version: **2.5.0**

<img width="420" height="600" alt="bookmarkview2-new" src="https://github.com/user-attachments/assets/0fceebd7-ec3c-405a-a79a-e7470069a722" />
<img width="420" height="600" alt="bookmarkview2-controls-new" src="https://github.com/user-attachments/assets/08a8473e-6866-43ad-b440-db2655cee4ba" />
<img width="420" height="600" alt="bookmarkview2-light" src="https://github.com/user-attachments/assets/291668af-6105-413c-be6a-8a203b9d31bc" />


## Installation Instructions

### For Google Chrome

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** by toggling the switch in the top-right corner.
4. Click on the **Load unpacked** button.
5. Select the folder containing the extension files (this repository).
6. The extension should now appear in your browser's toolbar.

### For Microsoft Edge

1. Clone or download this repository.
2. Open `edge://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.

### Updating

After pulling new changes, click **Reload** on the extension's card in `chrome://extensions/` or `edge://extensions/`.

## Usage

1. Click the Bookmark Viewer extension icon.
2. Load data using one of the following options:
	 - **Load Browser Bookmarks**: shows your current browser bookmarks. They're re-read each time the popup opens, so new or deleted bookmarks always show up.
	 - **Upload Bookmark File** (`.html` or `.json`): an exported bookmarks file. It's saved so it's still there the next time you open the popup.
3. Use the search box to filter the list. Each word is matched separately against the title, URL, and folder, so `github work` finds bookmarks containing both words.
4. Click any bookmark to open it in a new tab. **Ctrl+click** (**Cmd+click** on macOS) opens it in a background tab and keeps the popup open.
5. Use **Export** to download the loaded list as an HTML bookmarks file. Nested folders and the original date-added are kept, so the file can be imported back into any browser.
6. Use **Clear List** to reset the popup state.
7. Use the color wheel in the top-right to choose a custom background color (saved across popup sessions). Click **↺** to go back to the theme's default. On light colors, the text switches to dark so it stays readable.
8. Use the 🌙 / ☀️ button to switch between light and dark mode.

If no custom background color is selected, the popup keeps its default light/dark background based on the current theme.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Type | The search box is focused when the popup opens |
| **Enter** | Open the top search result |
| **Ctrl+Enter** | Open the top search result in a background tab |
| **Escape** | Clear the search |
| **Tab**, then **Enter** / **Space** | Reach and use the Controls header and the upload button |

## Permissions

- `bookmarks`: required to read bookmark data from the browser.
- `favicon`: shows site icons from the browser's own favicon cache. No requests are made to outside services, so your bookmarked sites aren't shared with anyone. Sites you've never visited in this browser show a generic icon.

## Project Structure

- `manifest.json`: extension metadata and permissions.
- `popup.html`: popup markup and styling.
- `popup.js`: bookmark loading, parsing, filtering, persistence, and export logic.
- `icons/`: extension icons (`16`, `48`, `128`).

## License

This project is licensed under the MIT License. See `LICENSE` for details.
