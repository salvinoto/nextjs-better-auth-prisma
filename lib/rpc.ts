// better-call (saul) client

import { createClient } from "better-call/client";
import { router } from "@/app/api/[[...route]]/route";

export const client = createClient<typeof router>({
    baseURL: "http://localhost:3000/api"
});