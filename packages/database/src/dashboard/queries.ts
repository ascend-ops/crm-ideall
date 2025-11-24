import { db } from "../../prisma/client";

export async function getClienteStatusCounts(
	profileId: string,
	tenantId: string,
	role: string,
) {
	const whereClause = role === "parceiro" ? { profileId } : { tenantId };

	return db.cliente.groupBy({
		by: ["status"],
		_count: { status: true },
		where: whereClause,
	});
}
