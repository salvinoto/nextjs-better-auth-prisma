import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { getActiveSubscription, ActiveSubscriptionResult } from "@/lib/stripe/stripe";
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
          const sub = await getActiveSubscription(customerId);
          if (sub) {
            setSubscription({
              plan: sub.plan,
              subscription: sub.subscription
            });
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