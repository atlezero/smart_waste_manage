export { default } from "next-auth/middleware";

export const config = {
    // Protect specific routes or all frontend routes excluding login/api
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - login (login page)
         * - logo.svg (logo)
         * - register (register page)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|login|register|logo.svg).*)"
    ],
};
