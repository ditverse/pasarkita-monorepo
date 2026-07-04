const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock user repository
const userRepository = require('../src/repositories/user.repository');
const authService = require('../src/modules/auth/auth.service');
const { AppError } = require('../src/utils/app-error');

test('Auth Service Unit Tests with repository mocking', async (t) => {
  // Mock data
  const mockUser = {
    id: 'user-uuid-123',
    name: 'Budi Utomo',
    email: 'budi@gmail.com',
    password_hash: await bcrypt.hash('secret123', 10),
    role: 'buyer',
    is_active: 1,
    created_at: new Date().toISOString(),
  };

  t.mock.method(userRepository, 'findByEmail', async (email) => {
    if (email === mockUser.email) return mockUser;
    return null;
  });

  t.mock.method(userRepository, 'findById', async (id) => {
    if (id === mockUser.id) return mockUser;
    return null;
  });

  t.mock.method(userRepository, 'create', async (name, email, passwordHash, role) => {
    return {
      id: 'new-uuid',
      name,
      email,
      role,
      is_active: 1,
      created_at: new Date().toISOString(),
    };
  });

  // Test register success
  await t.test('register should create a new user successfully', async () => {
    const payload = {
      name: 'Andi',
      email: 'andi@gmail.com',
      password: 'password123',
      role: 'buyer',
    };
    const result = await authService.register(payload);
    assert.strictEqual(result.name, 'Andi');
    assert.strictEqual(result.email, 'andi@gmail.com');
  });

  // Test register fail (existing email)
  await t.test('register should throw validation error if email exists', async () => {
    const payload = {
      name: 'Budi',
      email: 'budi@gmail.com',
      password: 'password123',
      role: 'buyer',
    };
    await assert.rejects(
      authService.register(payload),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  // Test login success
  await t.test('login should return token for valid credentials', async () => {
    const result = await authService.login({
      email: 'budi@gmail.com',
      password: 'secret123',
    });
    assert.ok(result.token);
    assert.strictEqual(result.user.name, 'Budi Utomo');
  });

  // Test login fail (wrong password)
  await t.test('login should fail with wrong password', async () => {
    await assert.rejects(
      authService.login({
        email: 'budi@gmail.com',
        password: 'wrongpassword',
      }),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.status, 401);
        assert.strictEqual(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  // Test getMe success
  await t.test('getMe should return user info for valid userId', async () => {
    const result = await authService.getMe('user-uuid-123');
    assert.strictEqual(result.name, 'Budi Utomo');
  });

  // Test getMe fail (not found)
  await t.test('getMe should throw not found error if user does not exist', async () => {
    await assert.rejects(
      authService.getMe('invalid-id'),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.code, 'NOT_FOUND');
        return true;
      }
    );
  });
});
