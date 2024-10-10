"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useSubscriptionData } from "@/lib/stripe/useSubscriptionData";
import getStripe from "@/lib/stripe/getStripe";
import Stripe from "stripe";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Define a custom type that includes prices
type ProductWithPrices = Stripe.Product & {
    prices: Array<Stripe.Price>;
};

export const PricingTable = () => {
    const [pricing, setPricing] = useState<ProductWithPrices[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [interval, setInterval] = useState<'month' | 'year'>('month');
    const { subscription, loading, activeOrg, user } = useSubscriptionData();
    const router = useRouter();
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await client("/pricing", {
                    method: "GET"
                });
                setPricing(response.data as ProductWithPrices[] || []);
            } catch (error) {
                console.error("Error fetching pricing data:", error);
                toast.error("Failed to load pricing information. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Create checkout session
    const handleCreateCheckoutSession = async (priceId: string) => {
        const customerId = activeOrg?.id || user?.id;
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

    const filteredPricing = pricing.filter(plan => plan.prices && plan.prices.length > 0)
        .map(plan => ({
            ...plan,
            prices: plan.prices.filter(price => price.recurring?.interval === interval)
        }))
        .filter(plan => plan.prices.length > 0);

    return (
        <Card className="flex flex-col items-center justify-center bg-background p-4">
            <CardHeader>
                <CardTitle>Choose Your Plan</CardTitle>
            </CardHeader>
            <CardContent>
                <ToggleGroup type="single" value={interval} onValueChange={(value) => setInterval(value as 'month' | 'year')}>
                    <ToggleGroupItem value="month">Monthly</ToggleGroupItem>
                    <ToggleGroupItem value="year">Yearly</ToggleGroupItem>
                </ToggleGroup>
                {isLoading ? (
                    <p className="text-center mt-8">Loading pricing information...</p>
                ) : filteredPricing.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mt-8">
                        {filteredPricing.map((plan) => (
                            <Card key={plan.id} className={`flex flex-col ${plan.metadata?.popular ? "border-primary" : ""}`}>
                                <CardHeader>
                                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                    {plan.metadata?.popular && (
                                        <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full absolute top-2 right-2">
                                            Popular
                                        </span>
                                    )}
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-4xl font-bold mb-4">
                                        ${(plan.prices[0]?.unit_amount ?? 0) / 100}
                                        <span className="text-sm font-normal text-muted-foreground">/{interval}</span>
                                    </p>
                                    <ul className="space-y-2">
                                        {plan.marketing_features?.map((feature, index) => (
                                            <li key={index} className="flex items-center">
                                                <Check className="h-5 w-5 text-green-500 mr-2" />
                                                <span>{feature.name ?? "Error loading feature"}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={plan.metadata?.popular ? "default" : "outline"}
                                        onClick={() => handleCreateCheckoutSession(plan.prices[0]?.id ?? '')}
                                    >
                                        Subscribe
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-center mt-8">No pricing plans available for the selected interval.</p>
                )}
            </CardContent>
        </Card>
    );
};
