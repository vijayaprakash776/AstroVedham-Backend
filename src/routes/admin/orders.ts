import { Router } from 'express';
import {
  getOrders,
  getOrderDetails,
  uploadReport as uploadReportController,
  cancelOrder
} from '../../controllers/admin/orderController';
import { uploadReport } from '../../middleware/upload';

const router = Router();

router.get('/', getOrders);
router.get('/:orderNumber', getOrderDetails);
router.post('/:orderNumber/report', uploadReport.single('report'), uploadReportController);
router.patch('/:orderNumber/cancel', cancelOrder);

export default router;
