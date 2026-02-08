import React from "react";

type OrganizationMember = {
	id: string;
	organizationId: string;
	userId: string;
	role: "admin" | "member" | "owner";
	createdAt: Date;
	user: { email: string; name: string; image?: string };
};

type OrganizationInvitation = {
	id: string;
	email: string;
	role: "admin" | "member" | "owner";
	organizationId: string;
	status: "pending" | "accepted" | "rejected" | "canceled";
	inviterId: string;
	expiresAt: Date;
	createdAt?: Date;
};

export type ClientOrganization = {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
	createdAt: Date;
	metadata?: unknown;
	members: OrganizationMember[];
	invitations: OrganizationInvitation[];
};

export const ActiveOrganizationContext = React.createContext<
	| {
			activeOrganization: ClientOrganization | null;
			activeOrganizationUserRole:
				| ClientOrganization["members"][number]["role"]
				| null;
			isOrganizationAdmin: boolean;
			loaded: boolean;
			setActiveOrganization: (
				organizationId: string | null,
			) => Promise<void>;
			refetchActiveOrganization: () => Promise<void>;
	  }
	| undefined
>(undefined);
