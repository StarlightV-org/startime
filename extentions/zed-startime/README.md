# Zed Startime Extension

This extension provides a way to track the time you spend coding in Zed.

## How to Install

1. Download this folder form [here](https://download-directory.github.io/?url=https://github.com/StarlightV-org/startime/tree/main/extentions/zed-startime)
2. Extract the downloaded folder to a directory of your choice
3. Open Zed and open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) > `zed: extensions` > `Install Dev Extension` and select the directory you extracted the folder to.
4. Then click rebuild once the extension is installed.
5. Set the either the ENV variable `STARTIME_TOKEN` or the `token` field in the extension settings to your Startime API token. You can get yours [here](https://time.starlightv.dev/dash/settings).

## Configuration

These settings can be set either in the project settings (`.zed/settings.json`) or your Zed settings.

```json
{
	"lsp": {
		"startime": {
			"initialization_options": {
				"url": "https://time.starlightv.dev", // This is the default URL.
				"token": "3755c8d9-8bcc-460f-b310-8a7149e32daf",
				"allowSelfSignedCertificates": false // this is for Dev only and should not be used in production
			}
		}
	}
}
```
