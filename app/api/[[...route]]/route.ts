// better-call (saul) server

import { createRouter } from "better-call"
import { createCustomerUserRoute, createCustomerOrganizationRoute, getActiveSubscriptionRoute, createCheckoutSessionRoute, createPortalSessionRoute, getPricingRoute } from "@/lib/stripe/stripe"

export const router = createRouter({
    createCustomerUserRoute,
    createCustomerOrganizationRoute,
    getActiveSubscriptionRoute,
    createCheckoutSessionRoute,
    createPortalSessionRoute,
    getPricingRoute,
}, {
    basePath: "/api"
})

export const GET = router.handler
export const POST = router.handler
export const PUT = router.handler
export const DELETE = router.handler