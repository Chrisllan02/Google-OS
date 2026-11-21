import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8'));

test('firestore.rules enforces global default-deny and rules_version 2', () => {
  assert.match(rules, /rules_version = '2';/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.includes('/users/{userId}'));
  assert.ok(paths.includes('/users/{userId}/workspace/{storeKey}'));
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.match(rules, /match \/workspace\/\{storeKey\}/);
});

test('firestore.rules enforces verified users, PII isolation, Master Gate, immutability, server timestamps, and bounded schemas', () => {
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /allow list:\s*if false;/);
  assert.match(rules, /allow list:\s*if isOwner\(userId\)\s*&& resource\.data\.ownerId == request\.auth\.uid;/);
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['displayName', 'email', 'photoURL', 'updatedAt'\]\)/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['items', 'record', 'textValue', 'updatedAt'\]\)/);
  assert.match(rules, /data\.items\.size\(\) <= 250/);
  assert.match(rules, /data\.textValue\.size\(\) <= 200000/);
  assert.match(rules, /isValidId\(userId\)/);
  assert.match(rules, /isValidId\(storeKey\)/);
});
