'use strict';

const request = require('supertest');
const app = require('../src/index');

describe('Health Endpoint', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Greeting Endpoint', () => {
  it('should return a greeting with default name', async () => {
    const res = await request(app).get('/api/greeting');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Hello, World!');
  });

  it('should return a greeting with provided name', async () => {
    const res = await request(app).get('/api/greeting?name=Nia');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Hello, Nia!');
  });
});