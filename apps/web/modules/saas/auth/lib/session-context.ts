import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import React from "react";

export const SessionContext = React.createContext<
	| {
			session: SupabaseSession | null;
			user: SupabaseUser | null;
			loaded: boolean;
			reloadSession: () => Promise<void>;
	  }
	| undefined
>(undefined);
