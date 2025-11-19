"use client";

import { StatusChart } from "./components/StatusChart";

// Dados de teste
const data = [
	{ status: "Aprovado", count: 12 },
	{ status: "Em Análise", count: 5 },
	{ status: "Aguardando Documentação", count: 8 },
	{ status: "Reprovado", count: 2 },
	{ status: "Fidelizado", count: 3 },
];

export default function DashboardPage() {
	return (
		<div className="p-6 space-y-6">
			<StatusChart data={data} />
			{/* Aqui depois adicionarei os cards de gestores */}
		</div>
	);
}
