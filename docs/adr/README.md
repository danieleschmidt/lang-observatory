# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the lang-observatory project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Process

1. **Proposal**: Create a new ADR file using the template
2. **Discussion**: Team reviews and discusses the proposal
3. **Decision**: ADR is accepted, rejected, or superseded
4. **Implementation**: Follow through on accepted decisions

## ADR Template

Copy `template.md` when creating new ADRs and follow the naming convention:
`NNNN-title-of-decision.md`

## Status Definitions

- **Proposed**: Under consideration
- **Accepted**: Decision approved and implementation should follow
- **Deprecated**: No longer relevant, but kept for historical context
- **Superseded**: Replaced by a newer decision (link to new ADR)

## Index

| Number | Title | Status |
|--------|-------|--------|
| [0001](0001-adopt-adr-process.md) | Adopt ADR Process | Accepted |
| [0002](0002-helm-chart-architecture.md) | Helm Chart Architecture | Accepted |
| [0003](0003-observability-stack-selection.md) | Observability Stack Selection | Accepted |