import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { ActiveSubscriptionResult } from "@/lib/stripe/stripe";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { client } from "@/lib/rpc";
export function useSubscriptionData() {
  const activeOrg = useActiveOrganization();
  const { data: sessionData } = useSession();
  const [subscription, setSubscription] = useState<ActiveSubscriptionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscription() {
      const customerId = activeOrg?.data?.id ?? sessionData?.user.id;
      console.log('Customer ID:', customerId);
      if (customerId) {
        setLoading(true);
        try {
          const sub = await client("/active-subscription/:id", {
            method: "GET",
            params: { id: customerId ?? "" }
          });

          if (sub.data) {
            setSubscription({
              plan: sub.data.plan,
              subscription: sub.data.subscription
            });
            console.log('Subscription:', sub);
          } else {
            setSubscription(null);
          }
        } catch (error) {
          console.error("Error fetching subscription:", error);
          toast.error("Failed to fetch subscription information");
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