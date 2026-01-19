# BRIGX Tests

## Running Tests

```bash
# Run all tests
npm test
# or
npx jest

# Run tests in watch mode
npm run test:watch
# or
npx jest --watch

# Run with coverage
npx jest --coverage
```

## Test Suite: Annotation and Alignment Preservation

Located in `__tests__/annotation-alignment-preservation.test.ts`

### Purpose
Tests the critical data preservation logic that ensures:
1. **Annotations are preserved when alignments complete**
2. **Alignments are preserved when annotations are updated**  
3. **Both data types persist through multiple operations**

### Test Coverage

#### Alignment Completion Preserves Annotations
- ✅ Partial alignment updates keep existing annotations
- ✅ Final alignment merge maintains all annotations

#### Annotation Updates Preserve Alignment Data  
- ✅ Adding/editing annotations keeps hits, windows, statistics
- ✅ Deleting annotations doesn't remove alignment results

#### Multiple Operations
- ✅ Sequential alignment → annotation → alignment operations maintain all data

#### Edge Cases
- ✅ Undefined annotations handled gracefully
- ✅ Empty arrays processed correctly
- ✅ Missing statistics fields use sensible defaults

### Why These Tests Matter

The app has two asynchronous data sources:
1. **Alignment workers** - Process FASTA files and produce hit/window data
2. **Annotation editor** - User adds/edits gene annotations

These tests prevent regressions where:
- Running alignments wipes out manually added annotations
- Saving annotations clears computed alignment results
- Multiple operations cause data loss through improper merging

### Test Philosophy

Tests verify the **merge logic** rather than UI interactions:
- Pure data transformations
- Fast execution (no DOM rendering)
- Easy to debug failures
- Documents expected behavior

### Adding New Tests

When adding features that merge ring data:

```typescript
it('should preserve X when Y happens', () => {
  // Setup: Ring with existing data
  const ring = createMockRingData(...);
  
  // Action: Simulate the merge operation
  const updated = { ...ring, /* your merge logic */ };
  
  // Assert: Both old and new data present
  expect(updated.oldData).toBeDefined();
  expect(updated.newData).toBeDefined();
});
```

## Dependencies

- `jest` - Test runner
- `@jest/globals` - TypeScript types for Jest
- `ts-jest` - TypeScript transformation
- `jest-environment-jsdom` - DOM environment for React tests

## Configuration

- **jest.config.js** - Jest configuration with Next.js integration
- **jest.setup.js** - Global test setup and matchers
- **tsconfig.json** - TypeScript paths recognized in tests (`@/...`)
