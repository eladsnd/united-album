/**
 * Prisma Client Mock Singleton
 *
 * This file creates a mocked Prisma Client instance for use in Jest tests.
 * Following Prisma's best practices for unit testing with jest-mock-extended.
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep();

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

export default prismaMock;
