'use server';

import Stripe from "stripe";
import prisma from "@/prisma/prisma";

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

// export async function getActiveSubscription(id: string) {
//   // Find the customer (either personal or organization)
//   const customer = await prisma.customer.findFirst({
//     where: {
//       OR: [
//         { userId: id },
//         { organizationId: id }
//       ]
//     }
//   });
//   if (!customer) throw new Error('Customer not found');

//   // Retrieve the subscription using the stripeCustomerId
//   const subscriptions = await stripe.subscriptions.list({
//     customer: customer.stripeCustomerId,
//     status: 'active',
//     limit: 1
//   });

//   if (subscriptions.data.length === 0) {
//     console.log('No active subscription found');
//     // throw new Error('No active subscription found');
//     return null;
//   }

//   return subscriptions.data[0];
// }

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
  subscription: Stripe.Subscription;
} | null;