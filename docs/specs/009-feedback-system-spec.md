# Feedback System Specification

## Executive Summary

This document specifies a lightweight, context-aware feedback system for the FamilyFoodie application. The system enables users to provide feedback at any point during their experience through an unobtrusive floating action button that expands to reveal a quick feedback form. The solution prioritizes frictionless user interaction while capturing valuable context about when and where feedback occurs.

## Business Requirements

### Problem Statement
Currently, there is no structured way for users to provide feedback about their experience with FamilyFoodie. This limits our ability to:
- Identify pain points in the user journey
- Understand feature requests and priorities
- Detect bugs and usability issues
- Measure user satisfaction

### Success Criteria
- Users can provide feedback within 3 clicks from any page
- Feedback submission takes less than 30 seconds
- 10% of active users provide feedback within first month
- Admin team can review and categorize feedback efficiently
- Zero impact on application performance

## Technical Architecture

### System Components

#### 1. Database Schema

```sql
-- Feedback storage table
CREATE TABLE feedback (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  household_id INT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  category ENUM('bug', 'feature_request', 'general', 'praise') DEFAULT 'general',
  message TEXT,
  page_context VARCHAR(255) NOT NULL,
  user_agent VARCHAR(500),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('new', 'reviewed', 'actioned', 'closed') DEFAULT 'new',
  admin_notes TEXT,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_rating (rating)
);

-- Track feedback interactions
CREATE TABLE feedback_responses (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  feedback_id INT NOT NULL,
  admin_id INT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 2. Component Architecture

```
src/
├── app/
│   ├── components/
│   │   ├── feedback/
│   │   │   ├── FeedbackWidget.tsx       # Main floating button and form
│   │   │   ├── FeedbackForm.tsx         # The feedback form component
│   │   │   ├── RatingStars.tsx          # Star rating component
│   │   │   └── FeedbackSuccess.tsx      # Success message component
│   │   └── providers/
│   │       └── FeedbackProvider.tsx     # Context provider for feedback
│   ├── api/
│   │   └── feedback/
│   │       ├── route.ts                 # POST endpoint for submissions
│   │       └── [id]/
│   │           └── route.ts             # GET/PATCH for admin operations
│   └── admin/
│       └── feedback/
│           ├── page.tsx                 # Admin feedback dashboard
│           └── feedback-table.tsx       # Feedback list component
├── lib/
│   ├── hooks/
│   │   └── useFeedback.ts              # Custom hook for feedback
│   └── queries/
│       └── feedback.ts                  # Database queries for feedback
└── types/
    └── feedback.ts                      # TypeScript type definitions
```

### API Endpoints

#### POST /api/feedback
Submit new feedback
```typescript
interface FeedbackSubmission {
  rating?: number;        // 1-5 star rating
  category?: string;      // bug, feature_request, general, praise
  message?: string;       // User's feedback text
  pageContext: string;    // Current page URL
  metadata?: {
    lastActions?: string[];  // Recent user actions
    browserInfo?: string;    // User agent
    timestamp: number;       // Client timestamp
  };
}
```

#### GET /api/feedback (Admin only)
Retrieve feedback with filters
```typescript
interface FeedbackQuery {
  status?: 'new' | 'reviewed' | 'actioned' | 'closed';
  category?: string;
  rating?: number;
  userId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
```

#### PATCH /api/feedback/[id] (Admin only)
Update feedback status or add notes
```typescript
interface FeedbackUpdate {
  status?: 'reviewed' | 'actioned' | 'closed';
  adminNotes?: string;
}
```

## User Interface Design

### Feedback Widget States

#### 1. Collapsed State (Default)
- Floating button in bottom-right corner
- 48x48px circular button
- Contains feedback icon
- Semi-transparent background
- Appears on all authenticated pages
- Hidden during form inputs to avoid overlap

#### 2. Expanded State
- Modal overlay with form
- Maximum width: 400px
- Contains:
  - Close button (X)
  - Title: "Share Your Feedback"
  - 5-star rating component
  - Category selector (dropdown)
  - Message textarea (optional)
  - Submit button
  - Cancel button

#### 3. Success State
- Brief success message
- Auto-closes after 3 seconds
- Returns to collapsed state

### Visual Design

```css
/* Floating Button */
.feedback-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(79, 70, 229, 0.9); /* Indigo */
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 40;
  transition: transform 0.2s, opacity 0.2s;
}

.feedback-button:hover {
  transform: scale(1.1);
}

/* Feedback Form Modal */
.feedback-modal {
  position: fixed;
  bottom: 88px;
  right: 24px;
  width: 90%;
  max-width: 400px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 50;
}
```

## Implementation Details

### FeedbackProvider Context

```typescript
interface FeedbackContextType {
  isOpen: boolean;
  openFeedback: (category?: string) => void;
  closeFeedback: () => void;
  submitFeedback: (data: FeedbackSubmission) => Promise<void>;
  lastActions: string[];
  trackAction: (action: string) => void;
}
```

### User Action Tracking

The system tracks the last 3 user actions to provide context:
- Page navigations
- Button clicks on key features
- Form submissions
- Error occurrences

Example tracked actions:
- "Viewed meal plan for week 2024-W45"
- "Added recipe to plan: Chicken Parmesan"
- "Generated shopping list"
- "Imported recipe from PDF"

### Feedback Triggers

Strategic placement of feedback prompts after key workflows:

1. **After Meal Plan Save**
   ```typescript
   // In plan-client-multiweek.tsx
   const handleSavePlan = async () => {
     // ... existing save logic
     if (success) {
       feedbackContext.trackAction('Saved meal plan');
       // Optional: Prompt for feedback after 2 seconds
     }
   };
   ```

2. **After Shopping List Generation**
   ```typescript
   // In shop components
   const handleGenerateList = async () => {
     // ... existing logic
     feedbackContext.trackAction('Generated shopping list');
   };
   ```

3. **On Error Pages**
   ```typescript
   // In error.tsx
   useEffect(() => {
     feedbackContext.openFeedback('bug');
   }, []);
   ```

## Admin Dashboard

### Feedback Management Interface

#### Features
1. **Feedback Table**
   - Sortable columns: Date, User, Rating, Category, Status
   - Inline preview of message (truncated)
   - Click to expand full details
   - Bulk status updates

2. **Filters**
   - Date range picker
   - Status filter (new/reviewed/actioned/closed)
   - Category filter
   - Rating filter (1-5 stars)
   - User/Household search

3. **Analytics Overview**
   - Average rating over time
   - Feedback volume trends
   - Category distribution
   - Top reported issues

4. **Export Functionality**
   - CSV export of filtered results
   - Include all metadata
   - Scheduled reports (future enhancement)

### Admin Workflow

1. **Review Process**
   - New feedback appears in "New" status
   - Admin reviews and categorizes
   - Can add internal notes
   - Update status to "Reviewed"

2. **Action Tracking**
   - Link feedback to GitHub issues
   - Track resolution in admin notes
   - Update status to "Actioned" when addressed
   - Close when verified/deployed

## Security Considerations

### Rate Limiting
- Maximum 10 feedback submissions per user per hour
- Maximum 50 submissions per household per day
- Implement exponential backoff for repeated submissions

### Data Validation
- Sanitize all text inputs
- Validate rating range (1-5)
- Verify user authentication
- Validate category against enum
- Maximum message length: 5000 characters

### Privacy
- No PII in metadata
- User agent stored for debugging only
- Option for anonymous feedback (future)
- GDPR-compliant data retention

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**
   - Load feedback widget only after initial page render
   - Use dynamic imports for feedback components

2. **Debouncing**
   - Debounce action tracking (500ms)
   - Throttle feedback submissions

3. **Caching**
   - Cache admin dashboard queries (5 minutes)
   - Use React Query for client-side caching

4. **Database Indexing**
   - Index on created_at for time-based queries
   - Index on status for filtering
   - Index on user_id for user history

## Testing Strategy

### Unit Tests
- FeedbackForm component validation
- Rating component interactions
- API endpoint validation
- Database query functions

### Integration Tests
- Full feedback submission flow
- Admin dashboard filtering
- Context provider integration
- Action tracking accuracy

### E2E Tests
- User feedback submission journey
- Admin review workflow
- Error handling scenarios
- Rate limiting behavior

## Migration Plan

### Phase 1: Core Implementation (Week 1)
- Database migration
- Basic widget component
- Submission API endpoint
- Context provider setup

### Phase 2: Admin Dashboard (Week 2)
- Admin interface
- Filtering and search
- Status management
- Basic analytics

### Phase 3: Enhanced Features (Week 3)
- Action tracking
- Strategic triggers
- Success animations
- Performance optimization

### Phase 4: Testing & Polish (Week 4)
- Comprehensive testing
- UI/UX refinements
- Documentation
- Team training

## Success Metrics

### Key Performance Indicators
1. **Adoption Rate**
   - Target: 10% of DAU submit feedback within 30 days
   - Measure: Unique users submitting feedback / DAU

2. **Feedback Quality**
   - Target: 60% of feedback marked as "actionable"
   - Measure: Actioned feedback / Total feedback

3. **Response Time**
   - Target: < 3 seconds to open feedback form
   - Target: < 1 second to submit feedback

4. **Admin Efficiency**
   - Target: < 2 minutes average review time
   - Measure: Time from "new" to "reviewed" status

### Monitoring
- Track widget load time
- Monitor submission success rate
- Alert on error spikes
- Dashboard usage analytics

## Future Enhancements

### Version 2.0
- In-app NPS surveys
- Sentiment analysis using AI
- Public roadmap integration
- User feedback history

### Version 3.0
- Feature voting system
- Feedback categories customization
- Automated responses for common issues
- Integration with customer support tools

### Version 4.0
- Mobile app SDK
- Voice feedback option
- Screen recording capability
- Real-time feedback chat

## Conclusion

This feedback system provides a frictionless way for users to share their experiences while giving the FamilyFoodie team actionable insights. The implementation prioritizes user experience, admin efficiency, and system performance, creating a sustainable feedback loop that will drive continuous product improvement.

The modular design allows for incremental enhancement without disrupting core functionality, ensuring the system can evolve with user needs and technological capabilities.