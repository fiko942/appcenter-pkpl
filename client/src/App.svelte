<script lang="ts">
    import { onMount } from 'svelte';
    import Router, { replace } from 'svelte-spa-router';
    import { wrap } from 'svelte-spa-router/wrap';
    import { checkSession, checkAdminSession } from './lib/stores/auth';
    import { theme } from './lib/stores/theme';

    import Dashboard from './lib/pages/Dashboard.svelte';
    import Tutorials from './lib/pages/Tutorials.svelte';
    import ProductDetail from './lib/pages/ProductDetail.svelte';
    import Downloads from './lib/pages/Downloads.svelte';
    import Licenses from './lib/pages/Licenses.svelte';
    import Orders from './lib/pages/Orders.svelte';
    import MemberInvoices from './lib/pages/MemberInvoices.svelte';
    import Login from './lib/pages/Login.svelte';
    import Register from './lib/pages/Register.svelte';
    import ForgotPassword from './lib/pages/ForgotPassword.svelte';
    import Profile from './lib/pages/Profile.svelte';
    import AdminLogin from './lib/pages/AdminLogin.svelte';
    import AdminDashboard from './lib/pages/AdminDashboard.svelte';
    import AdminPayments from './lib/pages/AdminPayments.svelte';
    import AdminCreateTrial from './lib/pages/AdminCreateTrial.svelte';
    import AdminProducts from './lib/pages/AdminProducts.svelte';
    import AdminCategories from './lib/pages/AdminCategories.svelte';
    import AdminAffiliate from './lib/pages/AdminAffiliate.svelte';
    import AdminAffiliateHistory from './lib/pages/AdminAffiliateHistory.svelte';
    import AdminProfile from './lib/pages/AdminProfile.svelte';
    import AdminUsers from './lib/pages/AdminUsers.svelte';
    import AdminSettings from './lib/pages/AdminSettings.svelte';
    import AdminOAuthClients from './lib/pages/AdminOAuthClients.svelte';
    import OAuthConsent from './lib/pages/OAuthConsent.svelte';
    import LandingPage from './lib/pages/LandingPage.svelte';
    import Terms from './lib/pages/Terms.svelte';
    import Privacy from './lib/pages/Privacy.svelte';
    import InvoicePublic from './lib/pages/InvoicePublic.svelte';
    import Affiliate from './lib/pages/Affiliate.svelte';
    import AffiliatePayouts from './lib/pages/AffiliatePayouts.svelte';

    // Member auth guard (Guest -> /member/login)
    async function requireMemberAuth(): Promise<boolean> {
        const isAuth = await checkSession();
        if (!isAuth) {
            replace('/member/login');
            return false;
        }
        return true;
    }

    // Admin auth guard (Guest -> /admin/login)
    async function requireAdminAuth(): Promise<boolean> {
        const isAuth = await checkAdminSession();
        if (!isAuth) {
            replace('/admin/login');
            return false;
        }
        return true;
    }

    // Redirect logged-in member away from login / register
    async function redirectIfMemberAuth(): Promise<boolean> {
        const isAuth = await checkSession();
        if (isAuth) {
            replace('/member/dashboard');
            return false;
        }
        return true;
    }

    // Redirect logged-in admin away from admin login
    async function redirectIfAdminAuth(): Promise<boolean> {
        const isAuth = await checkAdminSession();
        if (isAuth) {
            replace('/admin/dashboard');
            return false;
        }
        return true;
    }

    const routes = {
        // Public Landing Page (Accessible by anyone: guest, member, admin)
        '/': LandingPage,
        '/welcome': LandingPage,
        '/terms': Terms,
        '/privacy': Privacy,
        '/invoice/:token': wrap({
            component: InvoicePublic
        }),
        '/invoices/:token': wrap({
            component: InvoicePublic
        }),
        '/member/invoices/:token': wrap({
            component: InvoicePublic
        }),

        // Public / Guest Only (Member)
        '/member/login': wrap({
            component: Login,
            conditions: [redirectIfMemberAuth]
        }),
        '/member/register': wrap({
            component: Register,
            conditions: [redirectIfMemberAuth]
        }),
        '/member/forgot-password': wrap({
            component: ForgotPassword,
            conditions: [redirectIfMemberAuth]
        }),

        // Public / Guest Only (Admin)
        '/admin/login': wrap({
            component: AdminLogin,
            conditions: [redirectIfAdminAuth]
        }),

        // Protected Member Routes
        '/member': wrap({
            component: Dashboard,
            conditions: [requireMemberAuth]
        }),
        '/member/dashboard': wrap({
            component: Dashboard,
            conditions: [requireMemberAuth]
        }),
        '/member/tutorials': wrap({
            component: Tutorials,
            conditions: [requireMemberAuth]
        }),
        '/member/tutorials/:id': wrap({
            component: Tutorials,
            conditions: [requireMemberAuth]
        }),
        '/member/downloads': wrap({
            component: Downloads,
            conditions: [requireMemberAuth]
        }),
        '/member/orders': wrap({
            component: Orders,
            conditions: [requireMemberAuth]
        }),
        '/member/orders/create': wrap({
            component: ProductDetail,
            conditions: [requireMemberAuth]
        }),
        '/member/invoices': wrap({
            component: MemberInvoices,
            conditions: [requireMemberAuth]
        }),
        '/member/licenses': wrap({
            component: Licenses,
            conditions: [requireMemberAuth]
        }),
        '/member/affiliate': wrap({
            component: Affiliate,
            conditions: [requireMemberAuth]
        }),
        '/member/affiliate/payouts': wrap({
            component: AffiliatePayouts,
            conditions: [requireMemberAuth]
        }),
        '/member/profile': wrap({
            component: Profile,
            conditions: [requireMemberAuth]
        }),

        // Protected Admin Routes
        '/admin': wrap({
            component: AdminDashboard,
            conditions: [requireAdminAuth]
        }),
        '/admin/dashboard': wrap({
            component: AdminDashboard,
            conditions: [requireAdminAuth]
        }),
        '/admin/users': wrap({
            component: AdminUsers,
            conditions: [requireAdminAuth]
        }),
        '/admin/payments': wrap({
            component: AdminPayments,
            conditions: [requireAdminAuth]
        }),
        '/admin/trials/create': wrap({
            component: AdminCreateTrial,
            conditions: [requireAdminAuth]
        }),
        '/admin/products': wrap({
            component: AdminProducts,
            conditions: [requireAdminAuth]
        }),
        '/admin/categories': wrap({
            component: AdminCategories,
            conditions: [requireAdminAuth]
        }),
        '/admin/affiliate': wrap({
            component: AdminAffiliate,
            conditions: [requireAdminAuth]
        }),
        '/admin/affiliate-payouts': wrap({
            component: AdminAffiliate,
            conditions: [requireAdminAuth]
        }),
        '/admin/affiliate/payouts': wrap({
            component: AdminAffiliate,
            conditions: [requireAdminAuth]
        }),
        '/admin/affiliate/history': wrap({
            component: AdminAffiliateHistory,
            conditions: [requireAdminAuth]
        }),
        '/admin/affiliate/payout-history': wrap({
            component: AdminAffiliateHistory,
            conditions: [requireAdminAuth]
        }),
        '/admin/profile': wrap({
            component: AdminProfile,
            conditions: [requireAdminAuth]
        }),
        '/admin/settings': wrap({
            component: AdminSettings,
            conditions: [requireAdminAuth]
        }),
        '/admin/oauth-clients': wrap({
            component: AdminOAuthClients,
            conditions: [requireAdminAuth]
        }),

        // OAuth 2.0 Dedicated SSO & Consent Screen
        '/oauth/consent': wrap({
            component: OAuthConsent
        }),
        '/oauth/authorize': wrap({
            component: OAuthConsent
        }),

        // Catch-all
        '*': wrap({
            component: Dashboard,
            conditions: [requireMemberAuth]
        })
    };

    onMount(async () => {
        // Sync document data-theme
        document.documentElement.setAttribute('data-theme', $theme);
    });
</script>

<Router {routes} />
