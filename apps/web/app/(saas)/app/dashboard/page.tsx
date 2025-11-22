import { getClienteStatusCounts } from "@repo/database/src/dashboard/queries";
import { StatusChart } from "./components/StatusChart";

export default async function DashboardPage() {
	const rawData = await getClienteStatusCounts();

	const data = rawData.map((item) => ({
		status: item.status,
		count: item._count.status,
	}));

	return (
		<div className="p-6 space-y-6">
			<StatusChart data={data} />
		</div>
	);
}
