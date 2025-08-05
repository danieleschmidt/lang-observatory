# Rerere Cache Audit

This directory contains recorded conflict resolutions from Git's rerere (reuse
recorded resolution) mechanism.

## How it works

When Git encounters the same conflict pattern again, it automatically applies
the previously recorded resolution.

## Audit Process

- Run `git rerere diff` to see current recorded resolutions
- CI uploads rerere cache as artifacts for review
- Any suspicious automatic resolutions can be manually reviewed

## Cache Contents

The cache will be populated as conflicts are resolved and rerere records the
solutions.
