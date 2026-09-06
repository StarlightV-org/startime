# StarTime for Obsidian

Track time spent writing in Obsidian with your [StarTime](https://time.starlightv.dev) account. The plugin records relevant vault activity, shows the current project's time in the status bar, and provides a diagnostic activity log.

> [!info]+ Disclaimer
> StarTime is still in closed beta.
> Join our [Discord](https://starlightv.link/discord) and visit the [Repository](https://github.com/starlightv-org/startime) to contribute.

## Features

- Tracks file opens, editor changes, file creation, and file modifications.
- Displays today's tracked time for the active project in Obsidian's status bar.
- Uses the vault name as the project by default, with an optional project override.
- Keeps your StarTime token in Obsidian's secret storage.
- File names are hashed before being sent to the server.
- Includes a filterable activity log for connection and request diagnostics.
- Works on desktop and mobile Obsidian.

## Installation

### From a release

1. Download `main.js`, `manifest.json`, and `styles.css` from the desired release.
2. Create this folder in your vault:

   ```text
   <vault>/.obsidian/plugins/starlightv-codetime/
   ```

3. Copy the three downloaded files into that folder.
4. In Obsidian, open **Settings → Community plugins**, enable community plugins if needed, then enable **CodeTime.dev**.

### Development install

```bash
git clone <repository-url>
cd obsidian-codetime
npm install
npm run dev
```

For a one-off production build, run:

```bash
npm run build
```

Build output is written to `main.js` in the plugin root. Reload Obsidian after rebuilding.

## Setup

1. Sign in to [codetime.dev](https://codetime.dev) and get your token from its [account settings](https://codetime.dev/dashboard/settings).
2. In Obsidian, open **Settings → Community plugins → CodeTime.dev**.
3. Under **CodeTime Token**, select or create an Obsidian secret containing the token.
4. Confirm the status bar no longer says `CodeTime: No Token` or `CodeTime: Invalid Token`.

The plugin validates the token when its settings are applied. Clicking a missing- or invalid-token status item opens this settings page.

## Settings

| Setting          | Default                    | Description                                                                                                          |
| ---------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CodeTime Token   | —                          | An Obsidian secret containing the CodeTime API token. The token itself is not written to the plugin's settings data. |
| Server URL       | `https://api.codetime.dev` | CodeTime API base URL. Change this only when using another compatible server.                                        |
| Project Override | Vault name                 | Project name reported to CodeTime instead of the vault name.                                                         |

Use the reset button in the **CodeTime** settings section to restore the default server URL and project override. It keeps the configured token.

## What is tracked and sent

After a valid token is configured, the plugin sends activity events to the configured CodeTime server when you open a file, edit in the editor, create a file, or modify a file. Events for the same event type and file are throttled to at most one per second.

Each event includes the project, file type/extension, event time and type, read or edit operation, editor (`Obsidian`), platform, and placeholder Git origin/branch values. The plugin also requests the current project's daily time total once a minute to update the status bar.

With **Hide File Names** enabled (the default), the real filename and path are not sent; each event instead uses an anonymous generated name. The project name is still sent, so set a **Project Override** if your vault name is sensitive.

### Privacy notes

- Tracking requires network requests to the configured CodeTime server; it does not send vault note contents.
- Your token is retrieved from Obsidian secret storage. Only its secret reference is saved in plugin settings.
- Disabling the plugin stops its tracked event listeners and scheduled status updates.

## Activity log

Click the status-bar item while connected to open the activity log. It records connection state, authorization results, request attempts, throttling, and errors for the current session. Use the level selector and search field to narrow the displayed entries.

## Development

This project uses TypeScript, esbuild, npm, and the Obsidian API.

| Command         | Purpose                                    |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start esbuild in watch mode.               |
| `npm run build` | Type-check and create a production bundle. |
| `npm run lint`  | Run ESLint.                                |

The required release artifacts are `main.js`, `manifest.json`, and `styles.css`. Do not commit generated dependencies or build output.

## License

[MIT](LICENSE)
