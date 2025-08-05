# Contributing to Lang Observatory

We welcome contributions to Lang Observatory! This document provides guidelines
for contributing to the project.

## Code of Conduct

This project and everyone participating in it is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to
uphold this code.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the
[existing issues](https://github.com/terragon-labs/lang-observatory/issues) to
see if the problem has already been reported.

When creating a bug report, include:

- **Clear description** of the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (Kubernetes version, Helm version, etc.)
- **Logs and error messages** if applicable
- **Screenshots** if relevant

Use the bug report template when available.

### Suggesting Enhancements

Enhancement suggestions are welcome! When suggesting an enhancement:

- **Check existing feature requests** to avoid duplicates
- **Provide clear rationale** for why the enhancement would be useful
- **Include detailed description** of the proposed functionality
- **Consider backward compatibility** implications

### Pull Requests

#### Development Process

1. **Fork the repository** and create a feature branch from `main`
2. **Set up development environment** following the
   [Development Guide](docs/DEVELOPMENT.md)
3. **Make your changes** following our coding standards
4. **Add or update tests** for your changes
5. **Update documentation** if needed
6. **Run the test suite** to ensure nothing is broken
7. **Commit your changes** using conventional commits format
8. **Push to your fork** and submit a pull request

#### Pull Request Guidelines

- **Use clear titles** that describe what the PR does
- **Fill out the PR template** completely
- **Link related issues** using keywords (fixes #123, closes #456)
- **Keep PRs focused** - one feature/fix per PR
- **Update CHANGELOG.md** for user-facing changes
- **Include tests** for new functionality
- **Ensure CI passes** before requesting review

#### Conventional Commits

We use [Conventional Commits](https://conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(langfuse): add custom dashboard support
fix(prometheus): resolve memory leak in collector
docs: update installation instructions
test(helm): add integration tests for ingress
```

## Development Guidelines

### Code Standards

#### Helm Charts

- Use consistent naming conventions
- Include comprehensive comments
- Follow [Helm best practices](https://helm.sh/docs/chart_best_practices/)
- Use semantic versioning for chart versions
- Include resource limits and requests
- Support customization through values.yaml

#### YAML Files

- Use 2 spaces for indentation
- Keep lines under 120 characters
- Use meaningful names for resources
- Include appropriate labels and annotations
- Follow Kubernetes naming conventions

#### Scripts

- Use bash with `set -e` for error handling
- Include usage documentation
- Make scripts executable (`chmod +x`)
- Use meaningful variable names
- Include error checking and validation

#### Documentation

- Use clear, concise language
- Include code examples where appropriate
- Keep documentation up to date with code changes
- Use proper markdown formatting
- Include diagrams for complex concepts

### Testing Requirements

#### Unit Tests

- Write tests for all new functionality
- Maintain at least 80% code coverage
- Use descriptive test names
- Include both positive and negative test cases

#### Integration Tests

- Test component interactions
- Verify Helm chart rendering
- Test Kubernetes resource creation
- Include error scenarios

#### End-to-End Tests

- Test complete user workflows
- Verify service connectivity
- Test upgrade scenarios
- Include performance validation

### Documentation Requirements

- Update README.md for user-facing changes
- Update docs/ for architectural changes
- Include inline code comments for complex logic
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/)
  format

## Project Structure

```
lang-observatory/
├── charts/                 # Helm chart files
│   └── lang-observatory/
├── docs/                   # Documentation
├── scripts/               # Utility scripts
├── tests/                 # Test files
├── monitoring/            # Monitoring configs
├── security/              # Security policies
├── config/                # Configuration files
├── .github/               # GitHub workflows and templates
├── .devcontainer/         # Dev container configuration
└── package.json           # Node.js dependencies and scripts
```

## Getting Help

### Development Environment

1. **Read the docs**: Start with [Development Guide](docs/DEVELOPMENT.md)
2. **Use dev container**: Recommended for consistent environment
3. **Run tests early**: Catch issues before submitting PRs
4. **Ask questions**: Use GitHub Discussions for questions

### Code Review Process

1. **Automated checks**: CI must pass before review
2. **Manual review**: At least one maintainer review required
3. **Address feedback**: Respond to all review comments
4. **Re-review**: Request re-review after addressing feedback

### Community

- **GitHub Discussions**: For questions and general discussion
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: For real-time chat (link in README)
- **Email**: opensource@terragonlabs.com for private matters

## Release Process

### Version Management

- We use [Semantic Versioning](https://semver.org/)
- Releases are automated using semantic-release
- Version bumps are based on conventional commits
- Breaking changes require major version bump

### Release Notes

- Generated automatically from commit messages
- Include migration guides for breaking changes
- Highlight new features and important fixes
- Include known issues and workarounds

## Recognition

Contributors are recognized in several ways:

- **Contributors list**: Maintained in README.md
- **Release notes**: Major contributors mentioned
- **All Contributors**: Using the All Contributors bot
- **Annual recognition**: In project retrospectives

## License

By contributing to Lang Observatory, you agree that your contributions will be
licensed under the [Apache-2.0 License](LICENSE).

## Questions?

Don't hesitate to reach out:

- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues
- **Security issues**: security@terragonlabs.com
- **Other inquiries**: opensource@terragonlabs.com

Thank you for contributing to Lang Observatory!
