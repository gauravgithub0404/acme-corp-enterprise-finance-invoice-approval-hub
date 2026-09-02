/**
 * Unit tests for src/engine/irValidator.ts
 */
import { describe, it, expect } from 'vitest';
import { validateIR } from '../src/engine/irValidator';

// Minimal valid IR fixture
const VALID_IR: any = {
  name: 'Test App',
  domain: 'test-domain',
  ir_version: '1.0.0',
  app_id: 'app-test',
  entities: [
    {
      name: 'Request',
      fields: [
        { name: 'id', type: 'uuid', primary_key: true },
        { name: 'title', type: 'text' },
        { name: 'status', type: 'enum', enum_values: ['SUBMITTED', 'APPROVED'] }
      ]
    }
  ],
  roles: [
    { name: 'submitter', permissions: ['create:Request', 'read:own:Request'] },
    { name: 'approver', permissions: ['read:all:Request', 'approve:Request'] }
  ],
  workflows: [
    {
      name: 'RequestFlow',
      entity: 'Request',
      nodes: [
        { id: 'n1', name: 'Draft', type: 'state', execution_mode: 'deterministic' },
        { id: 'n2', name: 'Submitted', type: 'state', execution_mode: 'deterministic' },
        { id: 'n3', name: 'Approved', type: 'state', execution_mode: 'human' }
      ],
      edges: [
        { from: 'n1', to: 'n2', label: 'submit' },
        { from: 'n2', to: 'n3', label: 'approve' }
      ]
    }
  ],
  api_routes: [],
  ui_views: []
};

describe('validateIR — valid IR', () => {
  it('passes a well-formed IR without errors', () => {
    const result = validateIR(VALID_IR);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateIR — missing required fields', () => {
  it('reports error when name is missing', () => {
    const ir = { ...VALID_IR, name: '' };
    const result = validateIR(ir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'name')).toBe(true);
  });

  it('reports error when domain is missing', () => {
    const ir = { ...VALID_IR, domain: '' };
    const result = validateIR(ir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'domain')).toBe(true);
  });

  it('reports error when entities array is empty', () => {
    const ir = { ...VALID_IR, entities: [] };
    const result = validateIR(ir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'entities')).toBe(true);
  });

  it('reports error when roles array is empty', () => {
    const ir = { ...VALID_IR, roles: [] };
    const result = validateIR(ir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'roles')).toBe(true);
  });

  it('reports error when workflows array is empty', () => {
    const ir = { ...VALID_IR, workflows: [] };
    const result = validateIR(ir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'workflows')).toBe(true);
  });
});

describe('validateIR — referential integrity', () => {
  it('reports error when a workflow references a non-existent entity', () => {
    const ir = {
      ...VALID_IR,
      workflows: [
        {
          ...VALID_IR.workflows[0],
          entity: 'NonExistentEntity'
        }
      ]
    };
    const result = validateIR(ir);
    // Should either be invalid or have warnings about unknown entity
    const hasIssue = !result.valid || result.warnings.length > 0 || result.errors.length > 0;
    expect(hasIssue).toBe(true);
  });
});

describe('validateIR — multiple entities', () => {
  it('accepts an IR with multiple entities and cross-references', () => {
    const ir = {
      ...VALID_IR,
      entities: [
        {
          name: 'Employee',
          fields: [
            { name: 'id', type: 'uuid', primary_key: true },
            { name: 'name', type: 'text' }
          ]
        },
        {
          name: 'Leave',
          fields: [
            { name: 'id', type: 'uuid', primary_key: true },
            { name: 'employee_id', type: 'ref', ref: 'Employee' }
          ]
        }
      ]
    };
    const result = validateIR(ir);
    expect(result.valid).toBe(true);
  });
});
