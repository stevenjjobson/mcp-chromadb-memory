# Hacker News Post Examples

## Recommended: "Ask HN" Format

### Version 1: Discovery-Focused Question

**Title:** Ask HN: Why do AI coding tools use grep instead of indexed search?

**Body:**
```
I've been building a memory system for Claude and discovered something that doesn't make sense to me.

Every time these AI coding tools search for something (like "find authenticate function"), they run grep across the entire codebase and send ALL matching file contents to the LLM. This seems incredibly wasteful.

Real numbers from my project:
- Grep search: 45,000 tokens ($1.35), 3 seconds
- Indexed search: 2,400 tokens ($0.07), 0.1 seconds

I built a simple PostgreSQL index of code symbols and hook scripts to intercept the searches. Same results, 94% cheaper, 30x faster.

Is there a technical reason why Copilot, Cursor, Codeium, etc. don't do this? It seems like they're leaving hundreds of millions on the table. The implementation took me a weekend.

What am I missing?
```

### Version 2: Data-First Question

**Title:** Ask HN: Am I wrong that AI code search wastes 94% of tokens?

**Body:**
```
I instrumented my AI coding assistant to see why it was so expensive. The data shocked me:

Query: "class UserManager"
- Current method: grep -> 15,000 tokens
- Indexed method: find_symbol -> 200 tokens
- Savings: 98.7%

Query: "authenticate function"  
- Current method: grep -> 45,000 tokens
- Indexed method: symbol search -> 2,400 tokens
- Savings: 94.7%

I tested this across dozens of queries. The waste is consistent.

My solution: Index code symbols in PostgreSQL, intercept grep calls with hooks, route to indexed search. Takes milliseconds instead of seconds.

If this scales, GitHub Copilot alone could save ~$30M/year. That can't be right... can it?

Has anyone else noticed this? Am I calculating something wrong?
```

### Version 3: Technical Deep-Dive Question

**Title:** Ask HN: Found massive inefficiency in AI code search - what's the catch?

**Body:**
```
I've been debugging high API costs in my Claude integration and stumbled onto something weird.

The standard flow for code search in AI tools:
1. User queries "find X function"
2. Tool runs grep/ripgrep across codebase  
3. Entire file contents sent to LLM
4. LLM extracts relevant part
5. Cost: $1-2 per search

I tried a different approach:
1. Pre-index code symbols (functions, classes, etc)
2. Intercept grep calls with hook script
3. Query PostgreSQL instead
4. Send only symbol definition to LLM
5. Cost: $0.05-0.10 per search

The hook is dead simple:
```
if is_code_search(pattern):
    return f"Use find_symbol query='{query}' type=['function']"
```

This seems too easy. Why isn't everyone doing this? Technical debt? Architectural constraints I'm not seeing?

Would love to hear from anyone who's worked on these tools.
```

## Alternative: "Show HN" Format (If You Build Calculator)

### Version 1: Interactive Demo

**Title:** Show HN: See how much AI coding tools waste on your searches

**Body:**
```
I built a calculator that shows the hidden cost of AI code searches: https://aicostleak.com

Try entering any code search query and see:
- How many tokens current tools use
- How many they could use with indexing
- Your personal $$$ wasted

I discovered this optimizing my own project. Was spending $50/day on API calls, now spending $3.

The fix is embarrassingly simple: index symbols locally, search there first. 94% cost reduction, 30x speed improvement.

Technical details: PostgreSQL for symbols, hook scripts to intercept searches, ~200 lines of code total.

Curious if others have noticed this inefficiency?
```

## General Link Post (Not Recommended for First Post)

### Version 1: Bold Claim

**Title:** AI coding tools are wasting 94% of their API budget on inefficient searches

**Link:** [Your blog post or calculator]

### Version 2: Specific Numbers

**Title:** Grep vs indexed search in AI tools: 45,000 tokens vs 2,400 for the same result

**Link:** [Your analysis]

## Your First Comment (Post Immediately)

### For "Ask HN" Posts:
```
OP here. Some additional context:

I discovered this completely by accident. Was trying to figure out why my ChromaDB memory project was costing so much in API fees. Started logging token usage and nearly fell out of my chair.

A simple search for "authenticate function" was using 45,000 tokens because grep was sending entire file contents to Claude. Built a quick PostgreSQL index of symbols, intercepted the grep call, and the same search dropped to 2,400 tokens.

The implementation is genuinely trivial - happy to share code if anyone's interested. But I must be missing something because this would save companies millions.

What's the catch I'm not seeing?
```

### For "Show HN" Posts:
```
Creator here. Built this in a weekend after discovering my own AI coding assistant was bleeding money on searches.

The calculator uses real token counts from actual searches. You can verify the numbers yourself - just log your API calls and check.

Technical approach:
1. Parse code to extract symbols (using tree-sitter)
2. Store in PostgreSQL with type, location, signature
3. Hook script intercepts grep/glob calls
4. Route to indexed search when it's a code query
5. 94% reduction in tokens, 30x faster

Code will be open sourced once I clean it up. Would love feedback on the approach!
```

## Response Starters for Common Scenarios

### When Someone Confirms Your Finding:
"Glad I'm not crazy! Have you found any workarounds? I'd love to compare notes on implementation approaches."

### When Someone Challenges Your Numbers:
"Fair challenge! Here's my exact methodology: [details]. What would you measure differently? Always looking to improve my analysis."

### When Someone from a Big Company Responds:
"Thanks for chiming in! Without revealing anything proprietary, is this something you've considered internally? Would love to understand the constraints."

### When Someone Wants to Collaborate:
"Absolutely interested! Feel free to reach out at [email]. Would love to explore how to get this optimization into more hands."

## Remember

- Lead with curiosity, not certainty
- Share specific numbers and data
- Acknowledge potential flaws in your thinking
- Engage authentically with every response
- You're not selling - you're sharing a discovery

Pick the version that feels most natural to you. The "Ask HN" format is most likely to generate engaged discussion for a first-time poster.