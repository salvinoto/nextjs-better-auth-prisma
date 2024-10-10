"use client";

import { client } from "@/lib/rpc";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    organization,
    useActiveOrganization,
    useListOrganizations,
    useSession,
} from "@/lib/auth-client";
import { ActiveOrganization, Session } from "@/lib/auth-types";
import getStripe from "@/lib/stripe/getStripe";
import { ActiveSubscriptionResult } from "@/lib/stripe/stripe";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { Loader2, MailPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function BillingCard(props: { session: Session | null }) {
    const router = useRouter();
    const organizations = useListOrganizations();
    const activeOrg = useActiveOrganization();
    const [optimisticOrg, setOptimisticOrg] = useState<ActiveOrganization | null>(
        null,
    );
    const [isRevoking, setIsRevoking] = useState<string[]>([]);
    useEffect(() => {
        setOptimisticOrg(activeOrg.data);
    }, [activeOrg.data]);

    const { data } = useSession();
    const session = data || props.session;

    const currentMember = optimisticOrg?.members.find(
        (member) => member.userId === session?.user.id,
    );

    const [subscription, setSubscription] = useState<ActiveSubscriptionResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSubscription() {
            const customerId = activeOrg?.data?.id || session?.user.id;
            console.log('Customer ID:', customerId);
            if (customerId) {
                setLoading(true);
                try {
                    const sub = await client("/active-subscription/:id", {
                        method: "GET",
                        params: { id: customerId ?? "" }
                    });

                    if (sub.data) {
                        setSubscription({
                            plan: sub.data.plan,
                            subscription: sub.data.subscription
                        });
                        console.log('Subscription:', sub);
                    } else {
                        setSubscription(null);
                    }
                } catch (error) {
                    console.error("Error fetching subscription:", error);
                    toast.error("Failed to fetch subscription information");
                } finally {
                    setLoading(false);
                }
            }
        }

        fetchSubscription();
    }, [activeOrg?.data?.id, session?.user.id]);

    // Create checkout session
    const handleCreateCheckoutSession = async (priceId: string) => {
        const customerId = activeOrg?.data?.id || session?.user.id;
        try {
            const checkoutSession = await client("@post/create-checkout-session", {
                method: "POST",
                body: { customerId: customerId ?? "", priceId }
            });

            if (checkoutSession.data) {
                const stripe = await getStripe();
                const { error } = await stripe!.redirectToCheckout({
                    sessionId: checkoutSession.data.session.id,
                });
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
            toast.error("Error creating checkout session. Please contact support.", {
                action: {
                    label: "Support",
                    onClick: () => router.push("/support"),
                },
            });
        }
    };

    // Create portal session
    const handleCreatePortalSession = async () => {
        const customerId = activeOrg?.data?.id || session?.user.id;

        try {
            const portalSessionURL = await client("@post/create-portal-session", {
                method: "POST",
                body: { customerId: customerId ?? "" }
            });

            if (portalSessionURL.data) {
                router.push(portalSessionURL.data.sessionURL);
            }
        } catch (error) {
            console.error("Error creating portal session:", error);
            toast.error("Error creating portal session. Please contact support.", {
                action: {
                    label: "Support",
                    onClick: () => router.push("/support"),
                },
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Billing</CardTitle>
                <div className="flex justify-between">
                    <div>
                        <Button onClick={handleCreatePortalSession}>
                            <PlusIcon />
                            Manage Subscription
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="animate-spin" />
                    </div>
                ) : subscription ? (
                    <div>
                        <p className="font-semibold">Subscription Status</p>
                        <p className="mb-4 capitalize">{subscription.subscription.status}</p>
                        <p className="font-semibold">Next Billing Date</p>
                        <p>{new Date((subscription.subscription.currentPeriodEnd)).toLocaleDateString()}</p>
                    </div>
                ) : (
                    <p>No active subscription found.</p>
                )}
            </CardContent>
        </Card>
    );
}