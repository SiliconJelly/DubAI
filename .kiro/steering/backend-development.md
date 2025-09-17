# Backend Development Standards

## API Design Principles
- Use RESTful endpoints with consistent naming conventions (kebab-case for URLs)
- Implement comprehensive error handling with detailed error codes and messages
- Add request validation using Zod schemas for type safety
- Include rate limiting and authentication middleware on all protected endpoints
- Return consistent JSON response format with status, data, and error fields
- Use HTTP status codes appropriately (200, 201, 400, 401, 403, 404, 500)

## Database Design
- Use Prisma ORM for type-safe database operations
- Implement proper indexing for performance optimization on frequently queried fields
- Add database migrations for all schema changes with rollback capabilities
- Include data validation at the model level using Prisma validators
- Use transactions for operations that modify multiple tables
- Implement soft deletes for important data preservation

## Service Integration
- Create abstraction layers for external APIs (OpenSubtitles, Google TTS, Dailymotion)
- Implement retry logic with exponential backoff for external service calls
- Add comprehensive logging for debugging with structured log format
- Include health checks for all external services and dependencies
- Use environment variables for all configuration and secrets
- Implement circuit breaker pattern for unreliable external services

## Error Handling
- Create custom error classes for different error types
- Log all errors with context information and stack traces
- Return user-friendly error messages without exposing internal details
- Implement global error handler middleware
- Use proper error codes for different failure scenarios

## Performance & Scalability
- Implement caching strategies using Redis for frequently accessed data
- Use connection pooling for database connections
- Optimize database queries with proper indexing and query analysis
- Implement pagination for large data sets
- Use async/await patterns consistently for non-blocking operations

## Security
- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Use HTTPS for all API communications
- Store sensitive data encrypted at rest
- Implement CORS policies appropriately