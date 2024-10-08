"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Check } from "lucide-react";
import { getPricing } from "@/lib/stripe/stripe";
import { useEffect, useState } from "react";
import Stripe from "stripe";
import { useSubscriptionData } from "@/lib/stripe/useSubscriptionData";
import { createCheckoutSession } from "@/lib/stripe/stripe";
import getStripe from "@/lib/stripe/getStripe";

export const PricingTable = () => {
    const [pricing, setPricing] = useState<Stripe.Product[]>([]);
    const { subscription, loading, activeOrg, user } = useSubscriptionData();

    useEffect(() => {
        async function fetchData() {
            const pricing = await getPricing();
            setPricing(pricing);
        }
        fetchData();
    }, []);



    const handleCreateCheckoutSession = async (priceId: string) => {
        const customerId = activeOrg?.id || user?.id;

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
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <h1 className="text-3xl font-bold mb-8">Choose Your Plan</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {pricing.map((plan) => (
                    <Card key={plan.name} className={`flex flex-col ${plan.metadata.popular ? "border-primary" : ""}`}>
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                            {plan.metadata.popular && (
                                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full absolute top-2 right-2">
                                    Popular
                                </span>
                            )}
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <p className="text-4xl font-bold mb-4">
                                ${plan.default_price?.toString()}
                                <span className="text-sm font-normal text-muted-foreground">/month</span>
                            </p>
                            <ul className="space-y-2">
                                {plan.marketing_features.map((feature, index) => (
                                    <li key={index} className="flex items-center">
                                        <Check className="h-5 w-5 text-green-500 mr-2" />
                                        <span>{feature.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full"
                                variant={plan.metadata.popular ? "default" : "outline"}
                                onClick={() => handleCreateCheckoutSession(plan.id)}
                            >
                                Subscribe
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
};
