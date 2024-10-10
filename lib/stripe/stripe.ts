import { z } from "zod";
import Stripe from "stripe";
import prisma from "@/prisma/prisma";
import { auth } from "@/lib/auth";
import type { Subscription } from '@prisma/client'
import { createEndpoint, createRouter } from "better-call";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia",
});

export type ActiveSubscriptionResult = {
  plan: Stripe.Plan;
  subscription: Subscription;
} | null;

export const createCustomerUserRoute = createEndpoint("/create-customer-user", {
  method: "POST",
  body: z.object({
    userId: z.string(),
  })
}, async (ctx) => {
  const { userId } = ctx.body;
  const session = await auth.api.getSession({
    headers: ctx.headers!,
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

  return { stripeCustomerId: stripeCustomer.id };
});

export const createCustomerOrganizationRoute = createEndpoint("/create-customer-organization", {
  method: "POST",
  body: z.object({
    organizationId: z.string(),
  })
}, async (ctx) => {
  const { organizationId } = ctx.body;
  const session = await auth.api.getSession({
    headers: ctx.headers!,
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

  return { stripeCustomerId: stripeCustomer.id };
});

export const getActiveSubscriptionRoute = createEndpoint("/active-subscription/:id", {
  method: "GET",
  params: z.object({
    id: z.string(),
  })
}, async (ctx) => {
  const { id } = ctx.params;
  const session = await auth.api.getSession({
    headers: ctx.headers!,
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
    return null as ActiveSubscriptionResult;
  }

  const plan = await stripe.plans.retrieve(subscription.plan);

  return {
    plan: plan,
    subscription: subscription
  } as ActiveSubscriptionResult;
});

export const createCheckoutSessionRoute = createEndpoint("/create-checkout-session", {
  method: "POST",
  body: z.object({
    customerId: z.string(),
    priceId: z.string(),
  })
}, async (ctx) => {
  const { customerId, priceId } = ctx.body;
  const session = await auth.api.getSession({
    headers: ctx.headers!,
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

  return { session: checkoutSession };
});

export const createPortalSessionRoute = createEndpoint("/create-portal-session", {
  method: "POST",
  body: z.object({
    customerId: z.string(),
  })
}, async (ctx) => {
  const { customerId } = ctx.body;
  const session = await auth.api.getSession({
    headers: ctx.headers!,
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

  return { sessionURL: portalSession.url };
});

export const getPricingRoute = createEndpoint("/pricing", {
  method: "GET"
}, async () => {
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

  return productsWithPrices;
});
