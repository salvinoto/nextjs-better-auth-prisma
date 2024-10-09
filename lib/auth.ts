import { betterAuth } from "better-auth";
import { organization, passkey, twoFactor } from "better-auth/plugins";
import { reactInvitationEmail } from "./email/invitation";
import { reactResetPasswordEmail } from "./email/rest-password";
import { resend } from "./email/resend";
import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "better-auth/adapters/prisma";
import Stripe from "stripe";

const db = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2024-09-30.acacia",
});

const from = process.env.BETTER_AUTH_EMAIL || "delivered@resend.dev";
const to = process.env.TEST_EMAIL || "";

export const auth = betterAuth({
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
		async sendResetPassword(token, user) {
			const res = await resend.emails.send({
				from,
				to: user.email,
				subject: "Reset your password",
				react: reactResetPasswordEmail({
					username: user.email,
					resetLink: `${process.env.NODE_ENV === "development"
						? "http://localhost:3000"
						: process.env.NEXT_PUBLIC_APP_URL ||
						process.env.VERCEL_URL ||
						process.env.BETTER_AUTH_URL
						}/reset-password/${token}`,
				}),
			});
		},
		sendEmailVerificationOnSignUp: true,
		async sendVerificationEmail(email, url) {
			const res = await resend.emails.send({
				from,
				to: to || email,
				subject: "Verify your email address",
				html: `<a href="${url}">Verify your email address</a>`,
			});
			console.log(res, email);
		},
	},
	plugins: [
		organization({
			async sendInvitationEmail(data) {
				const res = await resend.emails.send({
					from,
					to: data.email,
					subject: "You've been invited to join an organization",
					react: reactInvitationEmail({
						username: data.email,
						invitedByUsername: data.inviter.user.name,
						invitedByEmail: data.inviter.user.email,
						teamName: data.organization.name,
						inviteLink:
							process.env.NODE_ENV === "development"
								? `http://localhost:3000/accept-invitation/${data.id}`
								: `https://${process.env.NEXT_PUBLIC_APP_URL ||
								process.env.VERCEL_URL ||
								process.env.BETTER_AUTH_URL
								}/accept-invitation/${data.id}`,
					}),
				});
				console.log(res, data.email);
			},
		}),
		twoFactor({
			otpOptions: {
				sendOTP(user, otp) {
					console.log({ otp });
				},
			},
		}),
		passkey(),
	],
	// socialProviders: {
	// 	github: {
	// 		clientId: process.env.GITHUB_CLIENT_ID || "",
	// 		clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
	// 	},
	// 	google: {
	// 		clientId: process.env.GOOGLE_CLIENT_ID || "",
	// 		clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
	// 	},
	// },
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					//perform additional actions, like creating a stripe customer
					const stripeCustomer = await stripe.customers.create({
						email: user.email,
						name: user.name,
						metadata: {
							userId: user.id,
						},
					});

					await db.customer.create({
						data: {
							stripeCustomerId: stripeCustomer.id,
							userId: user.id,
						},
					});
				},
			},
		},
	}
});
