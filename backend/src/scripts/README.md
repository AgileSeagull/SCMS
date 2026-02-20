# Database Scripts Documentation

This directory contains utility scripts for managing database data in the LibraryFlow system.

## Available Scripts

### 1. Populate Logs (`populateLogs.ts`)

**Purpose**: Populates the database with real student users and 500+ entry/exit logs spanning over a month to generate realistic test data for analytics.

**Features**:
- **Creates 20 real student users** with realistic names and university emails
- Generates 500 entry/exit logs distributed over the last 30 days
- Realistic activity patterns:
  - Higher activity on weekdays (70% of logs)
  - Peak hours: 8 AM - 10 AM (entries) and 4 PM - 8 PM (exits)
  - Lower activity on weekends (30% of logs)
- Proper ENTRY/EXIT alternation for each user
- Automatically calculates and updates system occupancy
- Distributes logs across all available student users

**Usage**:
```bash
npm run db:populate
```

**What it does**:
1. Creates 20 student users with realistic names and emails (if they don't exist)
2. Generates 500 logs with realistic timestamps
3. Ensures proper ENTRY/EXIT alternation for each user
4. Inserts logs in batches for performance
5. Calculates final occupancy based on all logs
6. Updates system configuration

**Output**:
- Total logs created
- Distribution of entries vs exits
- Current system occupancy
- Activity summary for the last 7 days

---

### 2. Reset Data (`resetData.ts`)

**Purpose**: Cleans up the database by removing all populated data and resetting to the state before running the populate script.

**Features**:
- **Deletes all populated student users** (created by populate script)
- Deletes all entry/exit logs
- Clears library status history
- Resets current occupancy to 0
- Sets max capacity to 100
- Creates a default OPEN library status
- **Preserves admin and any pre-existing users**

**Usage**:
```bash
npm run db:reset
```

**What it does**:
1. Displays current data statistics
2. Deletes all entry/exit logs (to avoid foreign key constraints)
3. Clears library status history
4. Deletes all populated student users (created by populate script)
5. Resets system configuration
6. Creates default library status
7. Verifies the reset was successful

**Warning**: This script will delete all populated student users, activity logs, and history. Only admin and pre-existing users are preserved.

---

## Common Workflows

### Populate → Test → Reset Cycle

```bash
# Step 1: Populate the database with test data
npm run db:populate

# Step 2: Test your features with the generated data
# (run your app, test analytics, etc.)

# Step 3: Reset when done testing
npm run db:reset
```

### Quick Database Reset

```bash
# Reset all logs and history
npm run db:reset

# Or start fresh with seeded data
npm run db:seed
npm run db:populate  # Optional: add more test data
```

### Full Database Reset

```bash
# Complete reset (MongoDB: re-seed from scratch)
cd backend
npm run db:seed
```

---

## Performance Notes

- **Populate Script**: Takes approximately 10-30 seconds to generate 500 logs
- **Reset Script**: Takes ~1-2 seconds to clean up
- Both scripts use batch operations for optimal performance
- The populate script shows progress updates every 50 logs

---

## Data Patterns

### Activity Distribution

- **Weekdays**: 70% of total activity
- **Weekends**: 30% of total activity
- **Peak Hours**: 80% probability during 8-10 AM and 4-8 PM
- **Normal Hours**: 50% probability
- **Weekend Hours**: 30% probability

### Time Distribution

- Logs are distributed evenly over 30 days
- Random times within each day
- Realistic patterns matching library usage

---

## Troubleshooting

### Error: "No users found in database"
**Solution**: The populate script now creates users automatically! Just run it directly:
```bash
npm run db:populate
```

If you want to use the original seed script instead:
```bash
npm run db:seed
```

### Error: Database connection issues
**Solution**: Ensure the backend is properly configured and database exists

---

### 3. Add Active Users (`addActiveUsers.ts`)

**Purpose**: Simulates QR code scans by randomly selecting student users and creating ENTRY logs for them, making them appear as active users inside the library. Perfect for testing and demo purposes.

**Usage**:
```bash
npm run db:add-active
```

**What it does**:
1. Fetches all student users from the database
2. Filters out users who are already inside (have active entries)
3. Checks current capacity and available slots
4. Randomly selects students (respects capacity limits)
5. Creates ENTRY logs with current timestamp and 1-hour expiration
6. Updates user statistics (frequencyUsed)
7. Updates system occupancy

**Features**:
- Respects capacity limits (won't exceed maxCapacity)
- Skips users already inside
- Randomly selects students for realistic testing
- Updates all relevant user and system statistics

**Output**:
- List of users added
- Updated occupancy status
- Current capacity information

---

### 4. Remove Active Users (`removeActiveUsers.ts`)

**Purpose**: Reverts changes made by `addActiveUsers.ts` by creating EXIT logs for all currently active users, effectively removing them from the library.

**Usage**:
```bash
npm run db:remove-active
```

**What it does**:
1. Finds all users currently inside (have ENTRY without subsequent EXIT)
2. Creates EXIT logs for all active users with current timestamp
3. Updates user's `lastActive` field
4. Updates system occupancy (decrements for each exit)

**Output**:
- List of users removed
- Updated occupancy status (should return to 0 or previous state)

---

## Common Workflows

### Testing/Demo Workflow

```bash
# Step 1: Add random active users
npm run db:add-active

# Step 2: Test your features with active users
# (test removal scores, analytics, etc.)

# Step 3: Remove all active users when done
npm run db:remove-active
```

### Full Testing Cycle

```bash
# Setup with test data
npm run db:populate        # Add historical logs and users

# Add active users for current testing
npm run db:add-active      # Make some users currently inside

# Test features
# ... test your features ...

# Cleanup
npm run db:remove-active   # Remove active users
npm run db:reset          # Optional: Full reset
```

### Schema sync (MongoDB)

```bash
npx prisma generate
npm run db:migrate   # or: npx prisma db push
```

### Script runs but no data appears
**Solution**: Check the console output for any errors. Ensure you have student users in the database.

---

## Script Locations

- `src/scripts/populateLogs.ts` - Log population script
- `src/scripts/resetData.ts` - Data reset script
- `src/seed.ts` - Initial database seeding

---

## See Also

- `package.json` - Script definitions
- `prisma/schema.prisma` - Database schema
- Main README for general setup instructions
