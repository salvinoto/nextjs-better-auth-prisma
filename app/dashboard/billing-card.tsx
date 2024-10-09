"use client";

import { hono } from "@/lib/hono/client";
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
                    const response = await hono.api.stripe["active-subscription"][":id"].$get({
                        param: { id: customerId ?? "" }
                    });
                    const sub = await response.json();
                    if (sub) {
                        setSubscription({
                            plan: sub.plan,
                            subscription: {
                                ...sub.subscription,
                                createdAt: new Date(sub.subscription.createdAt),
                                updatedAt: new Date(sub.subscription.updatedAt),
                                currentPeriodStart: new Date(sub.subscription.currentPeriodStart),
                                currentPeriodEnd: new Date(sub.subscription.currentPeriodEnd)
                            }
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
            const response = await hono.api.stripe["create-checkout-session"].$post({
                json: { customerId: customerId ?? "", priceId }
            });
            const checkoutSession = await response.json();

            const stripe = await getStripe();
            const { error } = await stripe!.redirectToCheckout({
                sessionId: checkoutSession.session.id,
            });

            if (error) {
                console.warn(error.message);
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
            // You might want to show an error message to the user here
        }
    };

    // Create portal session
    const handleCreatePortalSession = async () => {
        const customerId = activeOrg?.data?.id || session?.user.id;

        try {
            const response = await hono.api.stripe["create-portal-session"].$post({
                json: { customerId: customerId ?? "" }
            });
            const portalSessionURL = await response.json();

            router.push(portalSessionURL.sessionURL);
        } catch (error) {
            console.error("Error creating portal session:", error);
            // You might want to show an error message to the user here
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
                        <p>{new Date(Number(subscription.subscription.currentPeriodEnd) * 1000).toLocaleDateString()}</p>
                    </div>
                ) : (
                    <p>No active subscription found.</p>
                )}
            </CardContent>
        </Card>
    );
}