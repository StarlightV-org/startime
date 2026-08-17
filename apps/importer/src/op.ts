import { OpenPanel } from "@openpanel/nextjs";
import { ENV } from "@startime/env";

export const op = new OpenPanel({
	clientId: ENV.CLIENT_ID,
	clientSecret: ENV.CLIENT_SECRET,
	apiUrl: ENV.NEXT_PUBLIC_OPENPANEL_API_URL,
	debug: true,
});
