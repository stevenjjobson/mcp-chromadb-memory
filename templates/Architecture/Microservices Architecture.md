# Microservices Architecture

## Purpose
Microservices architecture decomposes applications into small, independent services that communicate through well-defined APIs. Each service is responsible for a specific business capability.

## When to Use
- Large, complex applications with multiple teams
- Need for independent deployment and scaling
- Different parts require different technologies
- High availability and fault isolation requirements

## Key Principles

### 1. Service Boundaries
- **Single Responsibility**: Each service handles one business capability
- **Data Ownership**: Each service owns its data and database
- **API-First**: Services communicate only through APIs

### 2. Communication Patterns
```yaml
# Synchronous - REST/GraphQL
Service A --> API Gateway --> Service B

# Asynchronous - Event-Driven
Service A --> Message Queue --> Service B
         \--> Event Bus -----> Service C
```

### 3. Essential Components
```
┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │     │  Load Balancer  │
└────────┬────────┘     └────────┬────────┘
         │                       │
    ┌────┴────┐            ┌────┴────┐
    │Service A│            │Service B│
    │  DB-A   │            │  DB-B   │
    └─────────┘            └─────────┘
```

## Implementation Example

### Service Structure (Node.js)
```javascript
// service-a/index.js
const express = require('express');
const app = express();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'service-a' });
});

// Business logic
app.post('/api/orders', async (req, res) => {
  const order = await orderService.create(req.body);
  
  // Emit event for other services
  await eventBus.emit('order.created', order);
  
  res.json(order);
});
```

### Docker Compose Setup
```yaml
version: '3.8'
services:
  api-gateway:
    image: kong:latest
    ports:
      - "8080:8000"
    
  service-a:
    build: ./service-a
    environment:
      - DB_HOST=postgres-a
      - REDIS_HOST=redis
    
  service-b:
    build: ./service-b
    environment:
      - DB_HOST=postgres-b
      - REDIS_HOST=redis
```

## Best Practices

### 1. Service Design
- **Size**: Small enough to be maintained by 2-pizza team
- **Boundaries**: Align with business domains (DDD)
- **Independence**: Minimize inter-service dependencies

### 2. Data Management
- **No shared databases**: Each service owns its data
- **Event sourcing**: For data consistency across services
- **SAGA pattern**: For distributed transactions

### 3. Resilience
```javascript
// Circuit breaker pattern
const CircuitBreaker = require('opossum');

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

const breaker = new CircuitBreaker(callService, options);
```

### 4. Monitoring
- **Distributed tracing**: Jaeger, Zipkin
- **Centralized logging**: ELK stack
- **Metrics**: Prometheus + Grafana

## Common Pitfalls

1. **Too Fine-Grained**: Creating too many small services
2. **Distributed Monolith**: High coupling between services
3. **Data Consistency**: Not planning for eventual consistency
4. **Network Latency**: Underestimating communication overhead
5. **Testing Complexity**: Not investing in integration tests

## Security Considerations

- **Service-to-service auth**: mTLS or service mesh
- **API Gateway security**: Rate limiting, authentication
- **Secrets management**: Vault, K8s secrets
- **Zero-trust networking**: Assume breach, verify everything

## References
- [Martin Fowler - Microservices](https://martinfowler.com/articles/microservices.html)
- [12 Factor App](https://12factor.net/)
- [Domain-Driven Design](https://domainlanguage.com/ddd/)
- [Building Microservices - Sam Newman](https://samnewman.io/books/building_microservices/)

---
*Part of CoachNTT Templates - Industry Best Practices*