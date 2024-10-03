import Stripe from "stripe";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia",
});

const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

const webhookHandler = async (req: NextRequest) => {
  try {
    const buf = await req.text();
    const sig = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`❌ Error message: ${errorMessage}`);
      return NextResponse.json(
        {
          error: {
            message: `Webhook Error: ${errorMessage}`,
          },
        },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;

        // Find the customer in our database
        let customer = await prisma.customer.findUnique({
          where: { stripeCustomerId },
        });

        if (!customer) {
          // Retrieve customer from Stripe to get metadata
          const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);

          // Get userId or organizationId from metadata
          const metadata = 'deleted' in stripeCustomer ? {} : stripeCustomer.metadata as { [key: string]: string };
          const userId = metadata.userId;
          const organizationId = metadata.organizationId;

          if (!userId && !organizationId) {
            console.error(
              `No userId or organizationId found in metadata for customer ${stripeCustomerId}`
            );
            break;
          }

          // Create the customer in our database
          customer = await prisma.customer.create({
            data: {
              stripeCustomerId,
              userId,
              organizationId,
            },
          });
        }

        // Upsert the subscription in our database
        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: subscription.id },
          update: {
            status: subscription.status,
            plan: subscription.items.data[0]?.price.id || "unknown",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          create: {
            stripeSubscriptionId: subscription.id,
            customerId: customer.id,
            status: subscription.status,
            plan: subscription.items.data[0]?.price.id || "unknown",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });

        // Update isActive status on the Customer
        const isActive = subscription.status === "active" || subscription.status === "trialing";

        await prisma.customer.update({
          where: { stripeCustomerId },
          data: { isActive },
        });

        console.log(
          `📝 Subscription ${subscription.id} updated/created for customer ${stripeCustomerId}`
        );
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;

        // Find the customer in our database
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId },
        });

        if (customer) {
          // Update the subscription status to 'canceled'
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: subscription.status,
            },
          });

          // Update isActive status to false
          await prisma.customer.update({
            where: { stripeCustomerId },
            data: { isActive: false },
          });

          console.log(
            `🗑️ Subscription ${subscription.id} deleted for customer ${stripeCustomerId}`
          );
        } else {
          console.error(`Customer with stripeCustomerId ${stripeCustomerId} not found.`);
        }
        break;
      }
      default:
        console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Error in webhook handler: ${err}`);
    return NextResponse.json(
      {
        error: {
          message: `Internal Server Error`,
        },
      },
      { status: 500 }
    );
  }
};

export { webhookHandler as POST };
