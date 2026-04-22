# Bookmark Viewer Extension

Bookmark Viewer is a Manifest V3 browser extension for loading, searching, and exporting bookmarks from a compact popup UI.

Current extension version: **2.0.0**

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
