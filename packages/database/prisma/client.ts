import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const prismaClientSingleton = () => {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set");
	}

	const adapter = new PrismaPg({
		connectionString: process.env.DATABASE_URL,
	});

	return new PrismaClient({ adapter });
};

declare global {
	var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Lazy initialization: only create the client when first accessed, not at import time
const db = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		if (!globalThis.prisma) {
			globalThis.prisma = prismaClientSingleton();
		}
		return (globalThis.prisma as any)[prop];
	},
});

export { db };
