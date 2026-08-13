"use client";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export default function DataManagement() {
	return (
		<Card>
			<CardContent>
				<Button>Import</Button>
				<Button>Export</Button>
			</CardContent>
		</Card>
	);
}
