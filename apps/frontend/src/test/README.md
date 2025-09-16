# DubAI Frontend Testing Suite

This comprehensive testing suite covers all aspects of the DubAI frontend application, ensuring quality, accessibility, and reliability.

## Test Structure

```
src/test/
├── setup.ts                    # Test environment setup
├── config.ts                   # Test configuration and utilities
├── testRunner.ts               # Comprehensive test runner
├── integration/                # Integration tests
│   ├── fileUpload.test.tsx     # File upload flow tests
│   └── jobManagement.test.tsx  # Job management flow tests
├── e2e/                        # End-to-end tests (Playwright)
│   ├── auth.spec.ts           # Authentication flow tests
│   ├── fileUpload.spec.ts     # File upload E2E tests
│   ├── jobProcessing.spec.ts  # Job processing E2E tests
│   └── accessibility.spec.ts  # Accessibility E2E tests
├── visual/                     # Visual regression tests
│   └── visual.spec.ts         # Visual regression tests
└── accessibility/              # Accessibility unit tests
    └── a11y.test.tsx          # Accessibility compliance tests
```

## Component Tests

### Unit Tests
- **Hero Component**: Landing page hero section
- **Features Component**: Feature showcase section
- **Navbar Component**: Navigation with authentication states
- **Dashboard Component**: Main dashboard layout and functionality
- **ProtectedRoute Component**: Route protection logic
- **FileUploader Component**: File upload functionality
- **All Dashboard Components**: Job management, processing steps, etc.

### Hook Tests
- **useAuth**: Authentication state management
- **useFileUpload**: File upload state and progress
- **useApi**: API communication and error handling
- **useWebSocket**: Real-time communication
- **useCache**: Caching functionality
- **useResponsive**: Responsive design utilities

## Integration Tests

### File Upload Flow
- Complete file upload process from selection to completion
- File validation and error handling
- Progress tracking and user feedback
- Integration with job creation API

### Job Management Flow
- Job listing and status display
- Real-time updates via WebSocket
- Job cancellation and deletion
- Processing steps visualization
- Download functionality

## End-to-End Tests

### Authentication Flow
- User registration and login
- Form validation and error handling
- Session management
- Protected route access

### File Upload E2E
- Drag-and-drop file upload
- File type validation
- Upload progress indication
- Error recovery

### Job Processing E2E
- Complete job lifecycle testing
- Real-time status updates
- Processing steps visualization
- Download and sharing functionality

## Accessibility Tests

### Unit Level Accessibility
- WCAG 2.1 AA compliance
- Proper heading hierarchy
- Form labels and validation
- Color contrast requirements
- ARIA attributes and roles

### E2E Accessibility
- Keyboard navigation
- Screen reader compatibility
- Focus management
- High contrast mode support
- Reduced motion preferences

## Visual Regression Tests

### Component Snapshots
- Homepage layout
- Dashboard states (loading, error, success)
- Mobile responsive layouts
- Dark mode variations
- High contrast mode

### State Variations
- Button states (normal, hover, focus, disabled)
- Form validation states
- Loading indicators
- Error messages

## Test Configuration

### Environment Support
- **Development**: Fast feedback with basic coverage
- **CI/CD**: Comprehensive testing with full browser matrix
- **Production**: Smoke tests and critical path validation

### Browser Coverage
- Chrome/Chromium
- Firefox
- Safari/WebKit
- Mobile browsers (iOS Safari, Chrome Mobile)

### Coverage Requirements
- **Unit Tests**: 80% line coverage minimum
- **Integration Tests**: Critical user flows covered
- **E2E Tests**: Happy path and error scenarios
- **Accessibility**: WCAG 2.1 AA compliance

## Running Tests

### Individual Test Suites
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Accessibility tests
npm run test:accessibility

# Visual regression tests
npm run test:visual
```

### Comprehensive Testing
```bash
# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage

# Update visual snapshots
npm run test:visual:update
```

### Test Runner Options
```bash
# Run specific test suites
npm run test:all unit integration

# Setup environment only
npm run test:all --setup

# Get help
npm run test:all --help
```

## Continuous Integration

The test suite is designed to run in CI/CD environments with:
- Parallel test execution
- Retry logic for flaky tests
- Comprehensive reporting
- Coverage thresholds enforcement
- Visual regression baseline management

## Best Practices

### Test Writing
1. **Arrange-Act-Assert**: Clear test structure
2. **User-Centric**: Test from user perspective
3. **Isolation**: Tests should not depend on each other
4. **Descriptive**: Clear test names and descriptions
5. **Maintainable**: Easy to update when features change

### Accessibility Testing
1. **Automated Checks**: Use axe-core for automated testing
2. **Manual Testing**: Keyboard navigation and screen readers
3. **Real Users**: Include users with disabilities in testing
4. **Continuous**: Test accessibility throughout development

### Visual Testing
1. **Consistent Environment**: Stable test environment
2. **Meaningful Snapshots**: Focus on important visual elements
3. **Regular Updates**: Keep snapshots current with design changes
4. **Cross-Browser**: Test visual consistency across browsers

## Troubleshooting

### Common Issues
1. **Flaky Tests**: Add proper waits and stable selectors
2. **Mock Issues**: Ensure mocks match real API behavior
3. **Timing Issues**: Use proper async/await patterns
4. **Environment Issues**: Check test setup and configuration

### Debug Tools
- Vitest UI for interactive debugging
- Playwright trace viewer for E2E debugging
- Browser dev tools for component inspection
- Coverage reports for gap analysis

## Maintenance

### Regular Tasks
1. **Update Dependencies**: Keep testing libraries current
2. **Review Coverage**: Ensure adequate test coverage
3. **Update Snapshots**: Keep visual tests current
4. **Performance**: Monitor test execution time
5. **Documentation**: Keep test documentation updated

This testing suite ensures the DubAI frontend meets high standards for functionality, accessibility, and user experience across all supported platforms and devices.