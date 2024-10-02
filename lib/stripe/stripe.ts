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
  