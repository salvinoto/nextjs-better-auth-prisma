'use server';

import Stripe from "stripe";
import prisma from "@/prisma/prisma";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Subscription } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia",
});


export async function createStripeCustomerForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const stripeCustomer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id,
    },
  });

  // Save the stripeCustomerId in the customer table
  await prisma.customer.create({
    data: {
      stripeCustomerId: stripeCustomer.id,
      userId: user.id,
    },
  });

  return stripeCustomer.id;
}

export async function createStripeCustomerForOrganization(organizationId: string) {

  const session = await auth.api.getSession({
    headers: headers(),
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

  // Save the stripeCustomerId in the customer table
  await prisma.customer.create({
    data: {
      stripeCustomerId: stripeCustomer.id,
      organizationId: organization.id,
    },
  });

  return stripeCustomer.id;
}

export async function getActiveSubscription(id: string) {
  // Find the customer (either personal or organization)
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { userId: id },
        { organizationId: id }
      ]
    }
  });
  console.log('Customer:', customer);
  if (!customer) throw new Error('Customer not found');

  // Retrieve the subscription using the stripeCustomerId
  const subscriptions = await prisma.subscription.findFirst({
    where: {
      customerId: customer.stripeCustomerId,
      status: 'active',
    }
  });

  if (!subscriptions) {
    console.log('No active subscription found');
    // throw new Error('No active subscription found');
    return null;
  }

  // Get the plan
  const plan = await stripe.plans.retrieve(subscriptions.id);

  return {
    plan: plan,
    subscription: subscriptions
  };
}

export type ActiveSubscriptionResult = {
  plan: Stripe.Plan;
  subscription: Subscription;
} | null;

export async function createCheckoutSession(customerId: string, priceId: string) {
  const session = await auth.api.getSession(
    {
      headers: headers(),
    }
  );

  if (!session?.user) {
    throw new Error("You are not signed in.");
  }

  // Find the customer (either personal or organization)
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { userId: customerId },
        { organizationId: customerId }
      ]
    }
  });
  console.log('Customer:', customer);
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
}

export async function createPortalSession(customerId: string) {
  const session = await auth.api.getSession(
    {
      headers: headers(),
    }
  );

  if (!session?.user) {
    throw new Error("You are not signed in.");
  }

  // Find the customer (either personal or organization)
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { userId: customerId },
        { organizationId: customerId }
      ]
    }
  });
  console.log('Customer:', customer);
  if (!customer) throw new Error('Customer not found');

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `http://localhost:3000/dashboard`,
  });

  return { session: portalSession.url };
}

export async function getPricing() {
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
}
