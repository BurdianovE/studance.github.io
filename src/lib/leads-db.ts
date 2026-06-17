import { randomUUID } from 'node:crypto';
import { getDb } from './db';

export interface LeadInput {
  name: string;
  phone: string;
  direction?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return digits;
  }
  if (digits.length === 10) {
    return `7${digits}`;
  }
  return digits;
}

export function createLead(input: LeadInput): { id: string; createdAt: string } {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const direction = (input.direction ?? '').trim();

  if (name.length < 2) {
    throw new Error('Укажите имя');
  }
  if (phone.length !== 11) {
    throw new Error('Укажите корректный телефон');
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  getDb()
    .prepare('INSERT INTO leads (id, name, phone, direction, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, phone, direction || null, createdAt);
  return { id, createdAt };
}
