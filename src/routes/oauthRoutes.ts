import { Router } from 'express';
import { oauthController } from '../controllers/oauthController';

const router = Router();

// OAuth 2.0 Authorization Server Core Endpoints
router.get('/authorize', (req, res) => oauthController.handleAuthorize(req, res));
router.get('/api/auth-context', (req, res) => oauthController.getAuthContext(req, res));
router.get('/api/consent-details', (req, res) => oauthController.getAuthContext(req, res));
router.post('/api/login', (req, res) => oauthController.handleOAuthLogin(req, res));
router.post('/api/logout-current', (req, res) => oauthController.handleOAuthLogout(req, res));
router.get('/logout', (req, res) => oauthController.handleOAuthLogoutRedirect(req, res));
router.post('/logout', (req, res) => oauthController.handleOAuthLogoutRedirect(req, res));
router.post('/consent/decision', (req, res) => oauthController.handleConsentDecision(req, res));
router.post('/token', (req, res) => oauthController.handleToken(req, res));
router.get('/userinfo', (req, res) => oauthController.handleUserInfo(req, res));
router.post('/revoke', (req, res) => oauthController.handleRevoke(req, res));

export default router;
