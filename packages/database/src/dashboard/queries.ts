import { db } from "../../prisma/client";

export async function getClienteStatusCounts() {
  return db.cliente.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });
}
