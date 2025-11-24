import { StatusChart } from "./components/StatusChart";
import { getClienteStatusCounts } from "@repo/database/src/dashboard/queries";


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
      <StatusChart data={data} />
    </div>
  );
}
