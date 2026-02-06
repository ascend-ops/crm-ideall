import { ORPCError } from "@orpc/client";
import {
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
} from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyOrganizationMembership } from "../../organizations/lib/membership";

export const listPurchases = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/purchases",
		tags: ["Payments"],
		summary: "Get purchases",
		description:
			"Get all purchases of the current user or the provided organization",
	})
	.input(
		z.object({
			organizationId: z.string().optional(),
		}),
	)
	.handler(async ({ input: { organizationId }, context: { user } }) => {
		if (organizationId) {
			const membership = await verifyOrganizationMembership(organizationId, user.id);
			if (!membership) {
				throw new ORPCError("FORBIDDEN");
			}

			const purchases =
				await getPurchasesByOrganizationId(organizationId);

			return { purchases };
		}

		const purchases = await getPurchasesByUserId(user.id);

		return { purchases };
	});
