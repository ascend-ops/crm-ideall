export function validatePassword(password: string): {
	valid: boolean;
	error?: string;
} {
	if (password.length < 8) {
		return {
			valid: false,
			error: "A palavra-passe deve ter pelo menos 8 caracteres",
		};
	}
	if (!/[A-Z]/.test(password)) {
		return {
			valid: false,
			error: "A palavra-passe deve conter pelo menos 1 letra maiúscula",
		};
	}
	if (!/[a-z]/.test(password)) {
		return {
			valid: false,
			error: "A palavra-passe deve conter pelo menos 1 letra minúscula",
		};
	}
	if (!/[0-9]/.test(password)) {
		return {
			valid: false,
			error: "A palavra-passe deve conter pelo menos 1 número",
		};
	}
	return { valid: true };
}
