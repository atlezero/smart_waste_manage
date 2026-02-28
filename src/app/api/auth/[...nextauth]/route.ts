import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabaseServer } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Smart Waste Management Login",
            credentials: {
                username: { label: "Username", type: "text", placeholder: "admin" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                try {
                    // Try to find user in DB
                    const { data: user, error } = await supabaseServer
                        .from('users')
                        .select('*')
                        .eq('username', credentials.username)
                        .single();

                    if (!error && user) {
                        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
                        if (passwordMatch) {
                            return {
                                id: user.id.toString(),
                                name: user.name,
                                email: `${user.role}@smartwaste.local`, // encode role in email for now or just generic
                            };
                        }
                    }
                } catch (dbError) {
                    console.error('DB Auth error (users table might not exist):', dbError);
                }

                // Fallback to static admin (e.g. before DB is created)
                const validUsername = process.env.ADMIN_USERNAME || "admin";
                const validPassword = process.env.ADMIN_PASSWORD || "password123";

                if (
                    credentials?.username === validUsername &&
                    credentials?.password === validPassword
                ) {
                    return {
                        id: "1",
                        name: "Admin",
                        email: "admin@smartwaste.local"
                    };
                }
                return null;
            }
        })
    ],
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/login', // custom login page
    },
    secret: process.env.NEXTAUTH_SECRET || "smart-waste-secret-12345",
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = token.id;
            }
            return session;
        }
    }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
