# Clean Architecture

## Purpose
Clean Architecture creates systems that are independent of frameworks, testable, independent of UI, independent of database, and independent of any external agency. The business rules don't know anything about the outside world.

## Core Principles

### The Dependency Rule
Dependencies can only point inwards. Nothing in an inner circle can know anything about something in an outer circle.

```
┌─────────────────────────────────────────┐
│          External Interfaces            │
│  (Web, UI, DB, External Services)       │
├─────────────────────────────────────────┤
│         Interface Adapters              │
│  (Controllers, Presenters, Gateways)    │
├─────────────────────────────────────────┤
│         Application Business Rules      │
│          (Use Cases)                    │
├─────────────────────────────────────────┤
│         Enterprise Business Rules       │
│           (Entities)                    │
└─────────────────────────────────────────┘
```

## Layer Breakdown

### 1. Entities (Core Business Logic)
```typescript
// domain/entities/User.ts
export class User {
  constructor(
    private id: string,
    private email: string,
    private hashedPassword: string
  ) {}

  // Business rules that would exist even without the app
  isPasswordValid(password: string): boolean {
    return bcrypt.compareSync(password, this.hashedPassword);
  }

  canPerformAction(action: string): boolean {
    // Core business rule
    return this.permissions.includes(action);
  }
}
```

### 2. Use Cases (Application Business Rules)
```typescript
// application/usecases/CreateUserUseCase.ts
export class CreateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  async execute(request: CreateUserRequest): Promise<User> {
    // Application-specific business rule
    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const user = new User(
      generateId(),
      request.email,
      await hashPassword(request.password)
    );

    await this.userRepository.save(user);
    await this.emailService.sendWelcome(user);

    return user;
  }
}
```

### 3. Interface Adapters
```typescript
// infrastructure/controllers/UserController.ts
export class UserController {
  constructor(private createUserUseCase: CreateUserUseCase) {}

  async createUser(req: Request, res: Response) {
    try {
      const user = await this.createUserUseCase.execute({
        email: req.body.email,
        password: req.body.password
      });

      res.json({
        id: user.id,
        email: user.email
      });
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        res.status(409).json({ error: 'User already exists' });
      }
    }
  }
}
```

### 4. Frameworks & Drivers
```typescript
// infrastructure/repositories/PostgresUserRepository.ts
export class PostgresUserRepository implements UserRepository {
  async save(user: User): Promise<void> {
    await this.db.query(
      'INSERT INTO users (id, email, password) VALUES ($1, $2, $3)',
      [user.id, user.email, user.hashedPassword]
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] ? this.mapToUser(result.rows[0]) : null;
  }
}
```

## Project Structure
```
src/
├── domain/               # Enterprise Business Rules
│   ├── entities/
│   └── value-objects/
├── application/          # Application Business Rules  
│   ├── use-cases/
│   ├── interfaces/       # Repository interfaces
│   └── services/         # Application services
├── infrastructure/       # Frameworks & Drivers
│   ├── controllers/      # HTTP controllers
│   ├── repositories/     # Database implementations
│   ├── services/         # External service implementations
│   └── config/          # Framework configuration
└── main.ts              # Dependency injection root
```

## Dependency Injection
```typescript
// main.ts - Composition root
const dbConnection = new PostgresConnection(config.database);
const userRepository = new PostgresUserRepository(dbConnection);
const emailService = new SendGridEmailService(config.sendgrid);

const createUserUseCase = new CreateUserUseCase(
  userRepository,
  emailService
);

const userController = new UserController(createUserUseCase);

// Express setup
app.post('/users', (req, res) => userController.createUser(req, res));
```

## Benefits

1. **Independent of Frameworks**: Business logic doesn't depend on Express, React, etc.
2. **Testable**: Business rules can be tested without UI, database, or external services
3. **Independent of UI**: Can switch from web to console to mobile
4. **Independent of Database**: Can switch from Postgres to MongoDB
5. **Independent of External Services**: Can mock external dependencies

## Testing Strategy
```typescript
// Easy to test use cases
describe('CreateUserUseCase', () => {
  it('should create user when email is unique', async () => {
    const mockRepo = {
      findByEmail: jest.fn().mockResolvedValue(null),
      save: jest.fn()
    };
    const mockEmail = {
      sendWelcome: jest.fn()
    };

    const useCase = new CreateUserUseCase(mockRepo, mockEmail);
    const user = await useCase.execute({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(mockRepo.save).toHaveBeenCalledWith(user);
    expect(mockEmail.sendWelcome).toHaveBeenCalledWith(user);
  });
});
```

## Common Pitfalls

1. **Anemic Domain Models**: Entities with only getters/setters
2. **Use Case Explosion**: Too many single-method use cases
3. **Over-abstraction**: Adding unnecessary layers
4. **Leaking Details**: Database concerns in use cases
5. **Wrong Dependencies**: Outer layers depending on inner

## When to Use

✅ **Good fit for:**
- Complex business logic
- Long-lived applications
- Multiple user interfaces
- Need for high testability
- Teams with high turnover

❌ **Overkill for:**
- Simple CRUD applications
- Prototypes or MVPs
- Single-developer projects
- Short-lived applications

## References
- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Clean Architecture Book](https://www.amazon.com/Clean-Architecture-Craftsmans-Software-Structure/dp/0134494164)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)

---
*Part of CoachNTT Templates - Industry Best Practices*