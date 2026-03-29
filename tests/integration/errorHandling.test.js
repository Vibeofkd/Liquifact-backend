const request = require('supertest');
const app = require('../../src/index');

describe('API Integration Tests (Error Handling)', () => {
  test('GET /api/invoices should return 200 with data array', async () => {
    const response = await request(app).get('/api/invoices');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('POST /api/invoices without token should return 401 envelope', async () => {
    const response = await request(app)
      .post('/api/invoices')
      .send({});

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toBeDefined();
  });

  test('GET /api/escrow/error-test without token should return 401', async () => {
    const response = await request(app).get('/api/escrow/error-test');

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  });

  test('GET /unknown-route should return 404 standardized error', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('GET /health should return status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api should return api info', async () => {
    const response = await request(app).get('/api');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('LiquiFact API');
  });

  test('GET /api/escrow/:invoiceId should return escrow data', async () => {
    const token = require('jsonwebtoken').sign(
      { id: 'integration-test' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    const response = await request(app)
      .get('/api/escrow/test-invoice')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.invoiceId).toBe('test-invoice');
  });

  test('POST /api/invoices with amount should succeed', async () => {
    const token = require('jsonwebtoken').sign(
      { id: 'integration-test' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    const response = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, customer: 'Integration Co' });
    expect(response.status).toBe(201);
  });
});
