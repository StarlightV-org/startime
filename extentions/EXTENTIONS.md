# How extensions need to work

### Data they need to send

The schema for the api can be found [here](https://github.com/StarlightV-org/startime/blob/main/packages/zod/src/index.ts).

|   Field   |  Type  | Description                                                       | Example                             |
| :-------: | :----: | :---------------------------------------------------------------- | :---------------------------------- |
| eventTime |  date  | the event time when the event was triggered                       | "2023-05-15T10:30:00.000Z"          |
| language  | string | the language id of the file                                       | "typescript", "jsx", "python"       |
|  project  | string | the project folder name                                           | "startime"                          |
| fileHash  | string | the hash of the file content (will be hashed again on the server) | "abc123"                            |
|  editor   | string | Needs to be the name of the editor, First letter capitalized      | "Visual Studio Code" or "Zed"       |
| platform  | string | the platform the event was triggered on                           | "Windows 11", "macOS 26", "linux 6" |

```ts
// The zod schema for the input `POST` request to `/api/users/event-log` in the request body as JSON
export const inputEventLogSchema = z.union([
	z.object({
		eventTime: z.coerce.date(),
		language: z.string(),
		project: z.string(),
		fileHash: z.string(),
		editor: z.string(),
		platform: z.string(),
	}),
]);
// The request header
req.headers.get("x-api-key")
```

### Config options

Every extension has the following config options:

|     Option      |  Type  | Description                                                                                  | Default                       |
| :-------------: | :----: | :------------------------------------------------------------------------------------------- | :---------------------------- |
|     apiUrl      | string | the url of the api to send the data to                                                       | "https://time.starlightv.dev" |
|      token      | string | the token to use for authentication, Secret storage if possible, otherwise as global env var |                               |
| projectOverride | string | the project folder name to override the default project folder name                          | $projectFolderName            |

other options are permitted, but should be used sparingly.

### When events should be triggered

Every time the user does something in the editor, an event should be send.
The API limit is 1 event per second, but the extension should not send more than 1 event per 5 seconds to save on resources.

Possible triggered could be:

- `selectionChanged`
- `fileChanged`
- `fileSaved`
- `fileDeleted`
- `fileCreated`
- `editor text hover`

## Get current code time

Get the current code time for the project for it to be displayed in the editor.

```ts
// The zod schema for the input `GET` request to `/api/users/self/stats` in the request params
export const inputStatsSchema = z.object({
	project: z.string().optional(),
});
// The zod schema for the output `GET` request to `/api/users/self/stats` in the response body
export const outputStatsSchema = z.object({
	time: z.string(),
});

```

This returns a string in the format `0h 0m` with the number of hours and minutes the user has spent on the project since midnight.
If no project is specified, the total time for all projects since midnight is returned.

It is preferred to use the `project` query parameter to specify the project folder name.

## Extensions Technical

- The extensions should use the Editors Extensions / Plugins API
