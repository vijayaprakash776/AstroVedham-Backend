import { getOrders } from '../src/controllers/admin/orderController';
import prisma from '../src/config/prisma';

async function runUnitTests() {
  console.log('--- RUNNING CONTROLLER UNIT TESTS FOR DATE FILTERING ---');

  let passed = 0;
  let failed = 0;

  // Mock prisma.order.findMany and count
  let lastWherePassed: any = null;
  (prisma as any).order = {
    findMany: async (args: any) => {
      lastWherePassed = args.where;
      return [];
    },
    count: async (args: any) => {
      return 0;
    }
  };

  function createMockReqRes(query: any) {
    const req: any = { query };
    let statusCode = 200;
    let jsonBody: any = null;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      }
    };

    return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
  }

  async function testCase(name: string, query: any, expectedStatus: number, checkFn?: (body: any, where: any) => boolean) {
    lastWherePassed = null;
    const { req, res, getStatus, getBody } = createMockReqRes(query);
    await getOrders(req, res);

    const status = getStatus();
    const body = getBody();
    const statusOk = status === expectedStatus;
    const customOk = checkFn ? checkFn(body, lastWherePassed) : true;

    if (statusOk && customOk) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> Status: ${status} (expected ${expectedStatus}), Body:`, body, 'Where:', lastWherePassed);
      failed++;
    }
  }

  // 1. No date parameters
  await testCase('1. Default getOrders (no dates)', {}, 200, (body, where) => {
    return body.success === true && !where.createdAt;
  });

  // 2. Valid single day: fromDate=2026-09-23 & toDate=2026-09-23
  await testCase('2. Single day (2026-09-23)', { fromDate: '2026-09-23', toDate: '2026-09-23' }, 200, (body, where) => {
    const gte = where.createdAt?.gte?.toISOString();
    const lt = where.createdAt?.lt?.toISOString();
    return (
      body.success === true &&
      gte === '2026-09-23T00:00:00.000Z' &&
      lt === '2026-09-24T00:00:00.000Z'
    );
  });

  // 3. Valid multi-day range: 2026-09-01 to 2026-09-23
  await testCase('3. Multi-day range (2026-09-01 to 2026-09-23)', { fromDate: '2026-09-01', toDate: '2026-09-23' }, 200, (body, where) => {
    const gte = where.createdAt?.gte?.toISOString();
    const lt = where.createdAt?.lt?.toISOString();
    return (
      body.success === true &&
      gte === '2026-09-01T00:00:00.000Z' &&
      lt === '2026-09-24T00:00:00.000Z'
    );
  });

  // 4. Invalid fromDate format
  await testCase('4. Invalid fromDate format', { fromDate: 'invalid', toDate: '2026-09-23' }, 400, (body) => {
    return body.success === false && body.message === 'Invalid date range';
  });

  // 5. Invalid range (fromDate > toDate)
  await testCase('5. fromDate > toDate', { fromDate: '2026-09-23', toDate: '2026-09-01' }, 400, (body) => {
    return body.success === false && body.message === 'Invalid date range';
  });

  // 6. Date + status
  await testCase('6. Date + status', { fromDate: '2026-09-01', toDate: '2026-09-23', status: 'SUCCESS' }, 200, (body, where) => {
    return body.success === true && where.status === 'SUCCESS' && where.createdAt?.gte && where.createdAt?.lt;
  });

  // 7. Date + search
  await testCase('7. Date + search', { fromDate: '2026-09-01', toDate: '2026-09-23', search: 'AV-' }, 200, (body, where) => {
    return body.success === true && Array.isArray(where.OR) && where.createdAt?.gte && where.createdAt?.lt;
  });

  // 8. Date + pagination
  await testCase('8. Date + pagination', { fromDate: '2026-09-01', toDate: '2026-09-23', page: '2', limit: '5' }, 200, (body, where) => {
    return body.success === true && body.data.pagination.page === 2;
  });

  console.log(`\nUNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED.`);
  if (failed > 0) process.exit(1);
}

runUnitTests().catch(err => {
  console.error('Unit test error:', err);
  process.exit(1);
});
