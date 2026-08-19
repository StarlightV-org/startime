import { OpenPanel } from "@openpanel/nextjs";
import { ENV } from "@startime/env";

import "server-only";

export const op = new OpenPanel({
	clientId: ENV.OPEN_PANEL_CLIENT_ID,
	clientSecret: ENV.OPEN_PANEL_CLIENT_SECRET,
	apiUrl: ENV.NEXT_PUBLIC_OPENPANEL_API_URL,
	debug: true,
	disabled: ENV.OPEN_PANEL_DISABLED,
});
