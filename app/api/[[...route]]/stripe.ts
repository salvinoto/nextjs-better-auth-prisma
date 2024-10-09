import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import Stripe from "stripe";
import prisma from "@/prisma/prisma";
import { auth } from "@/lib/auth";
import type { Subscription } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-09-30.acacia",
});

type ActiveSubscriptionResult = {
    plan: Stripe.Plan;
    subscription: Subscription;
} | null;

export const createCustomerUserRoute = new Hono()
    .post(
        "/create-customer-user",
        zValidator(
            "json",
            z.object({
                userId: z.string(),
            })
        ),
        async (c) => {
            const { userId } = c.req.valid("json");
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session?.user) throw new Error('User not found');

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) throw new Error('User not found');

            const stripeCustomer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: {
                    userId: user.id,
                },
            });

            await prisma.customer.create({
                data: {
                    stripeCustomerId: stripeCustomer.id,
                    userId: user.id,
                },
            });

            return c.json({ stripeCustomerId: stripeCustomer.id });
        }
    );

export const createCustomerOrganizationRoute = new Hono()
    .post(
        "/create-customer-organization",
        zValidator(
            "json",
            z.object({
                organizationId: z.string(),
            })
        ),
        async (c) => {
            const { organizationId } = c.req.valid("json");
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session?.user) throw new Error('User not found');

            const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
            if (!organization) throw new Error('Organization not found');

            const stripeCustomer = await stripe.customers.create({
                name: organization.name,
                metadata: {
                    organizationId: organization.id,
                },
            });

            await prisma.customer.create({
                data: {
                    stripeCustomerId: stripeCustomer.id,
                    organizationId: organization.id,
                },
            });

            return c.json({ stripeCustomerId: stripeCustomer.id });
        }
    );

export const getActiveSubscriptionRoute = new Hono()
    .get(
        "/active-subscription/:id",
        zValidator(
            "param",
            z.object({
                id: z.string(),
            })
        ),
        async (c) => {
            const { id } = c.req.valid("param");
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session?.user) throw new Error('User not found');

            const customer = await prisma.customer.findFirst({
                where: {
                    OR: [
                        { userId: id },
                        { organizationId: id }
                    ]
                }
            });
            if (!customer) throw new Error('Customer not found');

            const subscription = await prisma.subscription.findFirst({
                where: {
                    customerId: customer.id,
                    AND: {
                        status: 'active',
                    },
                }
            });

            if (!subscription) {
                return c.json<ActiveSubscriptionResult>(null);
            }

            const plan = await stripe.plans.retrieve(subscription.plan);

            return c.json<ActiveSubscriptionResult>({
                plan: plan,
                subscription: subscription
            });
        }
    );

export const createCheckoutSessionRoute = new Hono()
    .post(
        "/create-checkout-session",
        zValidator(
            "json",
            z.object({
                customerId: z.string(),
                priceId: z.string(),
            })
        ),
        async (c) => {
            const { customerId, priceId } = c.req.valid("json");
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });

            if (!session?.user) {
                throw new Error("You are not signed in.");
            }

            const customer = await prisma.customer.findFirst({
                where: {
                    OR: [
                        { userId: customerId },
                        { organizationId: customerId }
                    ]
                }
            });
            if (!customer) throw new Error('Customer not found');

            const checkoutSession = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer: customer.stripeCustomerId,
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: process.env.NEXT_PUBLIC_WEBSITE_URL + `/dashboard`,
                cancel_url: process.env.NEXT_PUBLIC_WEBSITE_URL + '/dashboard',
                subscription_data: {
                    metadata: {
                        payingUserId: session.user.id,
                    },
                },
            });

            if (!checkoutSession.url) {
                throw new Error("Could not create checkout session");
            }

            return c.json({ session: checkoutSession });
        }
    );

export const createPortalSessionRoute = new Hono()
    .post(
        "/create-portal-session",
        zValidator(
            "json",
            z.object({
                customerId: z.string(),
            })
        ),
        async (c) => {
            const { customerId } = c.req.valid("json");
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });

            if (!session?.user) {
                throw new Error("You are not signed in.");
            }

            const customer = await prisma.customer.findFirst({
                where: {
                    OR: [
                        { userId: customerId },
                        { organizationId: customerId }
                    ]
                }
            });
            if (!customer) throw new Error('Customer not found');

            const portalSession = await stripe.billingPortal.sessions.create({
                customer: customer.stripeCustomerId,
                return_url: `http://localhost:3000/dashboard`,
            });

            return c.json({ sessionURL: portalSession.url });
        }
    );

export const getPricingRoute = new Hono()
    .get("/pricing", async (c) => {
        const products = await stripe.products.list({
            active: true,
            expand: ['data.default_price'],
            limit: 100,
        });

        const productsWithPrices = await Promise.all(products.data.map(async (product) => {
            const prices = await stripe.prices.list({
                product: product.id,
                active: true,
                limit: 100,
            });

            return {
                ...product,
                prices: prices.data,
            };
        }));

        return c.json(productsWithPrices);
    });

// Combine all routes
export const stripeRoute = new Hono()
    .route("/", createCustomerUserRoute)
    .route("/", createCustomerOrganizationRoute)
    .route("/", getActiveSubscriptionRoute)
    .route("/", createCheckoutSessionRoute)
    .route("/", createPortalSessionRoute)
    .route("/", getPricingRoute);