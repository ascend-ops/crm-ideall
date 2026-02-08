import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema/postgres";

// Check the drizzle documentation for more information on how to connect to your preferred database provider
// https://orm.drizzle.team/docs/get-started-postgresql

let _db: NodePgDatabase<typeof schema> | undefined;

function getDb() {
	if (!_db) {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			throw new Error("DATABASE_URL is not set");
		}
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { drizzle } = require("drizzle-orm/node-postgres");
		_db = drizzle(databaseUrl, { schema }) as NodePgDatabase<typeof schema>;
	}
	return _db;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
	get(_target, prop) {
		return (getDb() as any)[prop];
	},
});
