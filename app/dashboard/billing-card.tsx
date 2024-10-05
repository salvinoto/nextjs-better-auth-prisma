"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { getActiveSubscription, ActiveSubscriptionResult, createCheckoutSession } from "@/lib/stripe/stripe";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { Loader2, MailPlus } from "lucide-react";
import { useState, useEffect } from "react";

export function BillingCard(props: { session: Session | null }) {
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
            if (activeOrg?.data?.id ?? session?.user.id) {
                setLoading(true);
                try {
                    const sub = await getActiveSubscription(activeOrg?.data?.id ?? session?.user.id ?? "");
                    if (!sub) {
                        setSubscription(sub);
                        console.log('Subscription:', sub);
                    }
                } catch (error) {
                    console.error("Error fetching subscription:", error);
                    // toast.error("Failed to fetch subscription information");
                } finally {
                    setLoading(false);
                }
            }
        }

        fetchSubscription();
    }, []);

    // Create checkout session
    const handleCreateCheckoutSession = async (priceId: string) => {
        const customerId = activeOrg?.data?.id || session?.user.id;

        try {
            const { session: checkoutSession } = await createCheckoutSession(customerId ?? "", priceId);

            const stripe = await getStripe();
            const { error } = await stripe!.redirectToCheckout({
                sessionId: checkoutSession.id,
            });

            if (error) {
                console.warn(error.message);
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
            // You might want to show an error message to the user here
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Billing</CardTitle>
                <div className="flex justify-between">
                    <div>
                        <Button>
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
                        <p>{new Date(subscription.subscription.current_period_end * 1000).toLocaleDateString()}</p>
                    </div>
                ) : (
                    <p>No active subscription found.</p>
                )}
            </CardContent>
        </Card>
    );
}