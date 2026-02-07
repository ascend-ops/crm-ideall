/**
 * Validates that a redirect URL is safe (same-origin or relative path).
 * Prevents open redirect attacks via manipulated redirectTo parameters.
 */
export function getSafeRedirect(
	redirectTo: string | null | undefined,
	fallback: string,
): string {
	if (!redirectTo) {
		return fallback;
	}

	// Allow relative paths starting with /
	if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
		return redirectTo;
	}

	// For absolute URLs, validate same origin
	try {
		const url = new URL(redirectTo, window.location.origin);
		if (url.origin === window.location.origin) {
			return url.pathname + url.search + url.hash;
		}
	} catch {
		// Invalid URL
	}

	return fallback;
}
