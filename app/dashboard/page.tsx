import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserCard from "./user-card";
import { OrganizationCard } from "./organization-card";
import { hono } from "@/lib/hono/server";
import { BillingCard } from "./billing-card";
import { PricingTable } from "@/components/pricing-table";

export default async function DashboardPage() {
	const [session, activeSessions] = await Promise.all([
		auth.api.getSession({
			headers: headers(),
		}),
		auth.api.listSessions({
			headers: headers(),
		}),
	]).catch((e) => {
		throw redirect("/sign-in");
	});

	// const res = await hono.api.hello.$get({ query: { name: "Hono is properly running!" } });
	// const res2 = await hono.api.authorized.$post({ json: { name: "Hono is properly running!" } });
	// const data = await res.json();
	// const data2 = await res2.json();
	return (
		<div className="w-full">
			<div className="flex gap-4 flex-col">
				<UserCard
					session={JSON.parse(JSON.stringify(session))}
					activeSessions={JSON.parse(JSON.stringify(activeSessions))}
				/>
				<OrganizationCard session={JSON.parse(JSON.stringify(session))} />
				<BillingCard session={JSON.parse(JSON.stringify(session))} />
				<PricingTable />
				{/* <div>
					<h1>{data.message}</h1>
					<h1>{data2.message}</h1>
				</div> */}
			</div>
		</div>
	);
}
