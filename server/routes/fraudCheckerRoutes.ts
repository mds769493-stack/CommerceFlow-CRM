/**
 * Fraud Checker Express Routes
 */
import { Router } from 'express';
import { 
  checkFraud, 
  getSettings, 
  updateSettings, 
  testConnection, 
  getHistory, 
  deleteHistoryItem 
} from '../controllers/fraudCheckerController.ts';

export function createFraudCheckerRouter(authenticate: any): Router {
  const router = Router();

  // Core Fraud Check endpoint (supports authenticated users or session)
  router.post('/fraud-check', authenticate, checkFraud);
  router.post('/fraud-checker/check', authenticate, checkFraud);

  // Settings management
  router.get('/fraud-checker/settings', authenticate, getSettings);
  router.post('/fraud-checker/settings', authenticate, updateSettings);

  // Connection testing
  router.post('/fraud-checker/test-connection', authenticate, testConnection);

  // Search History
  router.get('/fraud-checker/history', authenticate, getHistory);
  router.delete('/fraud-checker/history/:id', authenticate, deleteHistoryItem);

  return router;
}
