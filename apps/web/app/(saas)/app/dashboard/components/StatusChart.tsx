"use client";

// biome-ignore assist/source/organizeImports: <>
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

interface ChartItem {
	status: string;
	count: number;
}

interface StatusChartProps {
	data: ChartItem[];
}

export function StatusChart({ data }: StatusChartProps) {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<BarChart data={data}>
				<XAxis dataKey="status" />
				<YAxis />
				<Tooltip />
				<Bar dataKey="count" fill="#4f46e5" />
			</BarChart>
		</ResponsiveContainer>
	);
}
