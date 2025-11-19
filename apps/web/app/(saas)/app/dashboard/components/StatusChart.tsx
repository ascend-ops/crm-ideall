"use client";

import {
	Bar,
	BarChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

type StatusChartProps = {
	data: { status: string; count: number }[];
};

export function StatusChart({ data }: StatusChartProps) {
	return (
		<div className="w-full h-64 bg-white rounded-lg shadow p-4">
			<h2 className="text-lg font-semibold mb-4">Clientes por Status</h2>
			<ResponsiveContainer width="100%" height="80%">
				<BarChart
					data={data}
					margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
				>
					<XAxis dataKey="status" />
					<YAxis allowDecimals={false} />
					<Tooltip />
					<Bar dataKey="count" fill="#4F46E5" />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
