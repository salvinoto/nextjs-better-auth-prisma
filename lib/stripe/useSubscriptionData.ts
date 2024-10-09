import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { ActiveSubscriptionResult } from "@/lib/stripe/stripe";
import { hono } from "@/lib/hono/client";
import { useState, useEffect } from "react";

export function useSubscriptionData() {
  const activeOrg = useActiveOrganization();
  const { data: sessionData } = useSession();
  const [subscription, setSubscription] = useState<ActiveSubscriptionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscription() {
      const customerId = activeOrg?.data?.id ?? sessionData?.user.id;
      if (customerId) {
        setLoading(true);
        try {
          const response = await hono.api.stripe["active-subscription"][":id"].$get({
            param: { id: customerId ?? "" }
          });
          const sub = await response.json();
          if (sub) {
            setSubscription({
              plan: sub.plan,
              subscription: {
                ...sub.subscription,
                createdAt: new Date(sub.subscription.createdAt),
                updatedAt: new Date(sub.subscription.updatedAt),
                currentPeriodStart: new Date(sub.subscription.currentPeriodStart),
                currentPeriodEnd: new Date(sub.subscription.currentPeriodEnd)
              }
            });
            console.log('Subscription:', sub);
          } else {
            setSubscription(null);
          }
        } catch (error) {
          console.error("Error fetching subscription:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchSubscription();
  }, [activeOrg?.data?.id, sessionData?.user.id]);

  return {
    subscription,
    loading,
    activeOrg: activeOrg?.data,
    user: sessionData?.user
  };
}