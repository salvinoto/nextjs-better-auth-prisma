
# better-auth, NextJS, Prisma, Hono, and Stripe template

  

This is an example of how to use better-auth with NextJS, Prisma, Hono, and Stripe.
  

**Implements the following features:**

Email & Password . Social Sign-in . Passkeys . Email Verification . Password Reset . Two Factor Authentication . Profile Update . Session Management . Organization, Members and Roles. Provided by better-auth.com, visit here for more docs on how to use the authentication system.

Subscription Management with Stripe for Organizations and Users individually.

Hono for API, with RPC for easy type safety on throughout application, with abiliy to call any API endpoint from any part of the application, or outside source.

  
  
## Work in progress

 

 - [x] Ability to create Stripe customer as an organization.
 - [x] Ability to charge per user for organizations.
 - [ ] Add the ability to create more roles than owner, admin, and member for organizations.
 - [ ] Create documentation showing how to use different database adapters.

## How to run

  

1. Clone the code sandbox (or the repo) and open it in your code editor

2. Move .env.example to .env and provide necessary variables

3. Run the following commands

```bash

pnpm install

npx prisma migrate dev

npx prisma generate

pnpm dev

```

4. Open the browser and navigate to `http://localhost:3000`