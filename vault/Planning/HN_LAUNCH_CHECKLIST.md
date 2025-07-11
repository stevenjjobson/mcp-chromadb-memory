# Hacker News Launch Checklist

## Pre-Launch Preparation (Day Before)

### Technical Evidence
- [ ] Screenshot of before/after token usage
- [ ] Screenshot of before/after timing
- [ ] Code snippet showing the hook implementation
- [ ] Cost calculation spreadsheet
- [ ] API usage logs (sanitized)

### Content Ready
- [ ] Main post written and reviewed
- [ ] First comment drafted
- [ ] Response templates prepared
- [ ] Technical details document ready
- [ ] Calculator demo (if applicable)

### Personal Prep
- [ ] LinkedIn profile updated
- [ ] Twitter/X profile current
- [ ] Calendar link for bookings ready
- [ ] Email notifications on
- [ ] 3-4 hour block scheduled

## Launch Day Morning

### 30 Minutes Before
- [ ] Final proofread of post
- [ ] Test all links work
- [ ] Close unnecessary browser tabs
- [ ] Put phone on silent
- [ ] Get coffee/water ready

### 5 Minutes Before
- [ ] Log into HN account
- [ ] Open "submit" page
- [ ] Copy post title to clipboard
- [ ] Copy post body to clipboard
- [ ] Take a deep breath

## Launch Sequence

### T-0: Post Submission
- [ ] Navigate to https://news.ycombinator.com/submit
- [ ] Paste title (DOUBLE CHECK - can't edit!)
- [ ] Paste text content
- [ ] Click submit
- [ ] Copy the post URL

### T+1 Minute: First Comment
Post your context comment immediately:
```
OP here. For context, I discovered this while building a memory system for Claude. 

I was shocked to see simple searches costing $1+ in API fees. After digging in, I found that grep operations send entire file contents to the LLM.

Built a simple PostgreSQL index of code symbols, and now searches cost $0.07 instead of $1.35.

Happy to share more technical details if anyone's interested. Genuinely curious if there's something I'm missing here.
```

### T+5 Minutes: Monitor & Engage
- [ ] Refresh page every 2-3 minutes
- [ ] Respond to first comment within 2 minutes
- [ ] Stay positive and curious
- [ ] Don't panic if no immediate traction

## Response Templates

### For Technical Questions
```
Great question about [specific topic]. Here's what I found:

[Technical detail with specific numbers]

In my implementation, I [specific approach]. The key insight was [main point].

Would love to hear if you've seen similar patterns in your work.
```

### For Skepticism
```
That's a really valid concern. You're right that [acknowledge their point].

In my testing, I found [specific data]. But you raise a good point about [their concern] - I should test that scenario.

How would you approach [specific aspect]?
```

### For Interest in Implementation
```
The core implementation is surprisingly simple:

1. Parse code files to extract symbols (I used [parser])
2. Store in PostgreSQL with structure: [brief schema]
3. Hook script intercepts grep/glob calls
4. Route to indexed search when appropriate

The tricky part was [specific challenge]. Happy to go deeper on any aspect.
```

### For Business Questions
```
I haven't done comprehensive market analysis, but based on public info:

- [Company] has ~X users
- Average Y searches/day
- At $0.40 waste per search
- = Roughly $Z annually

Even if my estimates are 50% high, it's still significant. Would love to see real usage data from someone at these companies.
```

## Common Questions Prep

### "Why hasn't this been done?"
"That's exactly what I'm trying to understand! My theories:
1. institutional inertia
2. Different priorities
3. Something I'm missing technically
What's your take?"

### "This seems too simple"
"I thought the same thing! The implementation really is just [X lines of code]. Sometimes simple solutions get overlooked. The hard part was discovering the inefficiency, not fixing it."

### "What about edge cases?"
"Great point. I've tested with:
- Codebases up to X files
- Y different languages
- Z patterns
Still saw 90%+ improvement. What edge cases are you thinking of?"

### "How can I try this?"
"I put together a simple calculator: [link if ready]
For implementation, the basic approach is: [brief steps]
Planning to open source a reference implementation soon."

## Monitoring Metrics

### First 30 Minutes
- [ ] Points: >5 good, >10 great
- [ ] Comments: >3 good, >7 great
- [ ] Your response time: <3 minutes

### First Hour
- [ ] Points: >20 good, >40 great
- [ ] Position on /newest
- [ ] Any appearance on front page

### First 2 Hours
- [ ] Front page position
- [ ] Comment thread depth
- [ ] Quality of discussion

## If Things Go Well

### When You Hit Front Page
- [ ] Keep engaging, don't disappear
- [ ] Add valuable information in comments
- [ ] Update LinkedIn: "On HN front page discussing API optimization"
- [ ] Prepare for inbound messages

### Managing Inbound
- [ ] Set up email filter for HN-related
- [ ] Create tracking spreadsheet
- [ ] Prioritize responses by potential
- [ ] Schedule calls for next week

## If Things Don't Go Well

### Low Traction Checklist
- [ ] Don't delete post
- [ ] Keep engaging with any comments
- [ ] Note time posted for future
- [ ] Save post content for reuse

### Next Steps
- [ ] Wait minimum 1 week
- [ ] Build karma through comments
- [ ] Try different angle/title
- [ ] Consider "Show HN" with calculator

## Post-Launch Actions

### Same Day
- [ ] Thank engaged commenters
- [ ] Note valuable feedback
- [ ] Update documentation based on questions
- [ ] Capture contact info from interested parties

### Next Day
- [ ] Follow up with high-value contacts
- [ ] Write reflection on what worked/didn't
- [ ] Start building requested features/docs
- [ ] Plan next content based on interest

## Emergency Responses

### If Accused of Shilling
"Not affiliated with any company - just a solo dev who found this while trying to reduce my own costs. Happy to share the actual bills/logs as proof."

### If Technical Error Found
"You're absolutely right - I made an error in [specific thing]. Let me recalculate... [updated numbers]. Thanks for catching that! The overall finding still holds but appreciate the correction."

### If Downvoted Heavily
Just stay engaged with constructive comments. Don't mention downvotes. Keep providing value.

## Remember

- You're sharing a discovery, not selling
- Curiosity > Certainty  
- Engagement > Perfection
- This is a marathon, not a sprint

Good luck! Your discovery is genuinely valuable - let that confidence carry through.