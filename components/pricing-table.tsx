"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Check } from "lucide-react";
import { hono } from "@/lib/hono/client"
import { useSubscriptionData } from "@/lib/stripe/useSubscriptionData";
import getStripe from "@/lib/stripe/getStripe";
import Stripe from "stripe";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Define a custom type that includes prices
type ProductWithPrices = Stripe.Product & {
    prices: Array<Stripe.Price>;
};

export const PricingTable = () => {
    const [pricing, setPricing] = useState<ProductWithPrices[]>([]);
    const [interval, setInterval] = useState<'month' | 'year'>('month');
    const { subscription, loading, activeOrg, user } = useSubscriptionData();

    useEffect(() => {
        async function fetchData() {
            const response = await hono.api.stripe.pricing.$get();
            const pricing = await response.json();
            setPricing(pricing as ProductWithPrices[]);
        }
        fetchData();
    }, []);

    const handleCreateCheckoutSession = async (priceId: string) => {
        const customerId = activeOrg?.id || user?.id;

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

    const filteredPricing = pricing.map(plan => ({
        ...plan,
        prices: plan.prices.filter(price => price.recurring?.interval === interval)
    }));

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
                                    {plan.marketing_features.map((feature, index) => (
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
            </CardContent>
        </Card>
    );
};
