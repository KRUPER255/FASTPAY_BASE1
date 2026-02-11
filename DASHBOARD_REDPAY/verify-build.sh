#!/bin/bash
# Quick verification script - no hanging commands

echo "=== Build Verification ==="
echo "Build file:"
ls -lh dist/assets/*.js 2>/dev/null | tail -1
echo ""
echo "Build timestamp:"
stat -c "%y" dist/assets/*.js 2>/dev/null | tail -1
echo ""
echo "Source code has theme selector:"
grep -q "Palette.*h-4" src/component/UnifiedLayout.tsx && echo "✓ Theme selector found in source" || echo "✗ Not found"
echo ""
echo "=== Done ==="
