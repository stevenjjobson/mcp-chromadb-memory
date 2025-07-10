# Event-Driven Architecture

## Purpose
Event-Driven Architecture (EDA) is a pattern where system components communicate through events. Components emit events when state changes occur, and other components react to these events asynchronously.

## Core Concepts

### Event Types
```typescript
// 1. Domain Events - Something that happened
interface OrderCreatedEvent {
  type: 'ORDER_CREATED';
  orderId: string;
  customerId: string;
  amount: number;
  timestamp: Date;
}

// 2. Commands - Request to do something
interface CreateOrderCommand {
  type: 'CREATE_ORDER';
  customerId: string;
  items: OrderItem[];
}

// 3. Queries - Request for information
interface GetOrderStatusQuery {
  type: 'GET_ORDER_STATUS';
  orderId: string;
}
```

## Architecture Patterns

### 1. Simple Event Bus
```javascript
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  emit(event) {
    const handlers = this.handlers.get(event.type) || [];
    handlers.forEach(handler => {
      // Async execution
      setImmediate(() => handler(event));
    });
  }
}

// Usage
eventBus.on('ORDER_CREATED', async (event) => {
  await inventoryService.reserveItems(event.orderId);
  await emailService.sendConfirmation(event.customerId);
});
```

### 2. Message Queue Pattern
```yaml
# docker-compose.yml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
```

```javascript
// Publisher
const amqp = require('amqplib');

async function publishEvent(event) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();
  
  await channel.assertExchange('events', 'topic', { durable: true });
  
  channel.publish(
    'events',
    event.type,
    Buffer.from(JSON.stringify(event)),
    { persistent: true }
  );
}

// Consumer
async function consumeEvents(eventType, handler) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();
  
  await channel.assertExchange('events', 'topic', { durable: true });
  const q = await channel.assertQueue('', { exclusive: true });
  
  channel.bindQueue(q.queue, 'events', eventType);
  
  channel.consume(q.queue, async (msg) => {
    const event = JSON.parse(msg.content.toString());
    await handler(event);
    channel.ack(msg);
  });
}
```

### 3. Event Sourcing
```typescript
// Event Store
class EventStore {
  async append(streamId: string, events: Event[]): Promise<void> {
    const stream = await this.getStream(streamId);
    
    for (const event of events) {
      await this.db.insert({
        streamId,
        eventType: event.type,
        eventData: event,
        eventVersion: stream.version + 1,
        timestamp: new Date()
      });
    }
  }

  async getEvents(streamId: string, fromVersion?: number): Promise<Event[]> {
    return this.db.query({
      streamId,
      eventVersion: { $gte: fromVersion || 0 }
    }).orderBy('eventVersion');
  }
}

// Aggregate reconstruction
class Order {
  static async fromEvents(events: Event[]): Promise<Order> {
    const order = new Order();
    
    for (const event of events) {
      switch (event.type) {
        case 'ORDER_CREATED':
          order.id = event.orderId;
          order.status = 'created';
          break;
        case 'ORDER_PAID':
          order.status = 'paid';
          order.paidAt = event.timestamp;
          break;
        case 'ORDER_SHIPPED':
          order.status = 'shipped';
          order.shippedAt = event.timestamp;
          break;
      }
    }
    
    return order;
  }
}
```

## Implementation Patterns

### 1. CQRS (Command Query Responsibility Segregation)
```typescript
// Command Side
class OrderCommandHandler {
  async handle(command: CreateOrderCommand): Promise<void> {
    const order = new Order(command);
    const events = order.getPendingEvents();
    
    await this.eventStore.append(order.id, events);
    await this.eventBus.publishAll(events);
  }
}

// Query Side
class OrderQueryHandler {
  async handle(query: GetOrderStatusQuery): Promise<OrderView> {
    // Read from optimized read model
    return this.readDb.findOne({ orderId: query.orderId });
  }
}

// Projection to update read model
class OrderProjection {
  async handle(event: OrderEvent): Promise<void> {
    switch (event.type) {
      case 'ORDER_CREATED':
        await this.readDb.insert({
          orderId: event.orderId,
          status: 'created',
          customerId: event.customerId
        });
        break;
    }
  }
}
```

### 2. Saga Pattern
```typescript
class OrderSaga {
  private steps = [
    { service: 'payment', action: 'charge', compensate: 'refund' },
    { service: 'inventory', action: 'reserve', compensate: 'release' },
    { service: 'shipping', action: 'schedule', compensate: 'cancel' }
  ];

  async execute(order: Order): Promise<void> {
    const executedSteps = [];
    
    try {
      for (const step of this.steps) {
        await this.eventBus.publish({
          type: `${step.service}.${step.action}`,
          orderId: order.id
        });
        executedSteps.push(step);
      }
    } catch (error) {
      // Compensate in reverse order
      for (const step of executedSteps.reverse()) {
        await this.eventBus.publish({
          type: `${step.service}.${step.compensate}`,
          orderId: order.id
        });
      }
      throw error;
    }
  }
}
```

## Best Practices

### 1. Event Design
- **Immutable**: Events represent facts that happened
- **Self-contained**: Include all necessary data
- **Versioned**: Support schema evolution
- **Idempotent**: Safe to process multiple times

### 2. Error Handling
```javascript
// Dead Letter Queue
async function processWithRetry(event, handler, maxRetries = 3) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      await handler(event);
      return;
    } catch (error) {
      attempts++;
      await delay(Math.pow(2, attempts) * 1000); // Exponential backoff
    }
  }
  
  // Send to DLQ
  await deadLetterQueue.send(event);
}
```

### 3. Monitoring
- **Event flow tracking**: Distributed tracing
- **Latency monitoring**: Time between emit and process
- **Failed event tracking**: DLQ monitoring
- **Event store size**: Regular cleanup strategies

## Common Pitfalls

1. **Event Payload Size**: Keeping events too large
2. **Ordering Dependencies**: Assuming event order
3. **Eventual Consistency**: Not handling read-after-write
4. **Event Sprawl**: Too many fine-grained events
5. **Missing Events**: No replay capability

## When to Use

✅ **Good for:**
- Microservices communication
- Real-time systems
- Audit requirements
- Complex workflows
- Scalability needs

❌ **Not ideal for:**
- Simple CRUD applications
- Strong consistency requirements
- Small, monolithic applications
- Teams new to async patterns

## Technology Choices

- **Message Brokers**: RabbitMQ, Apache Kafka, AWS SQS/SNS
- **Event Stores**: EventStore, Apache Kafka, Custom PostgreSQL
- **Stream Processing**: Apache Flink, Kafka Streams
- **Service Mesh**: Istio, Linkerd for event routing

## References
- [Martin Fowler - Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
- [Building Event-Driven Microservices](https://www.oreilly.com/library/view/building-event-driven-microservices/9781492057888/)

---
*Part of CoachNTT Templates - Industry Best Practices*