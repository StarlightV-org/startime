import { OpenPanel } from "@openpanel/nextjs";
import { ENV } from "@startime/env";

export const op = new OpenPanel({
	clientId: ENV.OPEN_PANEL_CLIENT_ID,
	clientSecret: ENV.OPEN_PANEL_CLIENT_SECRET,
	apiUrl: ENV.NEXT_PUBLIC_OPENPANEL_API_URL,
	debug: ENV.NODE_ENV === "development",
	disabled: ENV.OPEN_PANEL_DISABLED,
});
