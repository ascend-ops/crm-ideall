import { getClienteStatusCounts } from "@repo/database/src/dashboard/queries";
import { StatusChart } from "./components/StatusChart";

const profileId = "profile_test_1";
const tenantId = "tenant_test_1";
const role = "gestor";

export default async function DashboardPage() {
	const rawData = await getClienteStatusCounts(profileId, tenantId, role);

	const data = rawData.map((item) => ({
		status: item.status,
		count: item._count.status,
	}));

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-3xl font-bold text-gray-800">
				Dashboard de Clientes
			</h1>
			<p className="text-gray-500">
				Visualize o status dos seus clientes de forma clara.
			</p>

			<div className="w-full max-w-3x1 mx-auto">
				<StatusChart data={data} />
			</div>
		</div>
	);
}
