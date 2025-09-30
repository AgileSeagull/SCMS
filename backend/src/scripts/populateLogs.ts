import { PrismaClient, LogType, Role, Gender } from '@prisma/client';
import { hashPassword } from '../utils/auth';

const prisma = new PrismaClient();

// List of realistic student names and emails (metadata will be randomly generated)
const STUDENT_DATA = [
  { firstName: 'Rudra', lastName: 'Saxena', email: 'rudra.saxena@university.edu' },
  { firstName: 'Rohan', lastName: 'Sharma', email: 'rohan.sharma@university.edu' },
  { firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@university.edu' },
  { firstName: 'Arjun', lastName: 'Gupta', email: 'arjun.gupta@university.edu' },
  { firstName: 'Sneha', lastName: 'Reddy', email: 'sneha.reddy@university.edu' },
  { firstName: 'Vikram', lastName: 'Kumar', email: 'vikram.kumar@university.edu' },
  { firstName: 'Ananya', lastName: 'Singh', email: 'ananya.singh@university.edu' },
  { firstName: 'Rahul', lastName: 'Verma', email: 'rahul.verma@university.edu' },
  { firstName: 'Meera', lastName: 'Joshi', email: 'meera.joshi@university.edu' },
  { firstName: 'Aditya', lastName: 'Malhotra', email: 'aditya.malhotra@university.edu' },
  { firstName: 'Kavya', lastName: 'Nair', email: 'kavya.nair@university.edu' },
  { firstName: 'Siddharth', lastName: 'Sharma', email: 'siddharth.sharma@university.edu' },
  { firstName: 'Divya', lastName: 'Bansal', email: 'divya.bansal@university.edu' },
  { firstName: 'Kabir', lastName: 'Chopra', email: 'kabir.chopra@university.edu' },
  { firstName: 'Neha', lastName: 'Kapoor', email: 'neha.kapoor@university.edu' },
  { firstName: 'Karan', lastName: 'Agarwal', email: 'karan.agarwal@university.edu' },
  { firstName: 'Sanjana', lastName: 'Mehta', email: 'sanjana.mehta@university.edu' },
  { firstName: 'Harsh', lastName: 'Rao', email: 'harsh.rao@university.edu' },
  { firstName: 'Aanya', lastName: 'Iyer', email: 'aanya.iyer@university.edu' },
  { firstName: 'Rishabh', lastName: 'Tiwari', email: 'rishabh.tiwari@university.edu' },
];

/**
 * Get random gender
 */
function getRandomGender(): Gender {
  const genders = [Gender.MALE, Gender.FEMALE, Gender.OTHER];
  return genders[Math.floor(Math.random() * genders.length)];
}

/**
 * Get random age (between 18 and 25, typical student age range)
 */
function getRandomAge(): number {
  return 18 + Math.floor(Math.random() * 8); // 18-25
}

/**
 * Get random premium status (20% chance of being premium)
 */
function getRandomPremiumStatus(): boolean {
  return Math.random() < 0.2; // 20% premium users
}

/**
 * Get random voluntary exit score (0.2 to 0.95, avoiding extremes)
 */
function getRandomVoluntaryExitScore(): number {
  return 0.2 + (Math.random() * 0.75); // Range: 0.2 to 0.95
}

/**
 * Generate a random timestamp within the last N days
 */
function getRandomTimestamp(daysAgo: number): Date {
  const now = new Date();
  const daysInPast = Math.floor(Math.random() * daysAgo);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);
  
  const timestamp = new Date(now);
  timestamp.setDate(timestamp.getDate() - daysInPast);
  timestamp.setHours(hours, minutes, seconds);
  
  return timestamp;
}

/**
 * Generate realistic entry/exit patterns
 * - Higher activity during weekdays
 * - Peak hours: 8 AM - 10 AM (entries), 4 PM - 8 PM (exits)
 * - Lower activity on weekends
 */
function shouldGenerateLog(timestamp: Date): boolean {
  const dayOfWeek = timestamp.getDay();
  const hour = timestamp.getHours();
  
  // Lower probability on weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return Math.random() < 0.3; // 30% chance on weekends
  }
  
  // Higher probability during peak hours (weekdays)
  if ((hour >= 8 && hour <= 10) || (hour >= 16 && hour <= 20)) {
    return Math.random() < 0.8; // 80% chance during peak hours
  }
  
  // Normal activity during other hours
  return Math.random() < 0.5; // 50% chance during normal hours
}

/**
 * Calculate final occupancy based on entry/exit logs
 */
function calculateOccupancy(logs: Array<{ type: string }>): number {
  let occupancy = 0;
  for (const log of logs) {
    if (log.type === 'ENTRY') {
      occupancy++;
    } else if (log.type === 'EXIT') {
      occupancy = Math.max(0, occupancy - 1);
    }
  }
  return occupancy;
}

async function populateLogs() {
  try {
    console.log('🚀 Starting log population...');
    
    // Get or create student users
    console.log('\n👥 Setting up student users...');
    const users = [];
    const defaultPassword = await hashPassword('Student123!');
    
    for (const studentData of STUDENT_DATA) {
      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email: studentData.email }
      });
      
      if (!user) {
        // Randomly generate all user fields
        const age = getRandomAge();
        const gender = getRandomGender();
        const premiumUser = getRandomPremiumStatus();
        const voluntaryExitScore = getRandomVoluntaryExitScore();
        
        // Create new user
        user = await prisma.user.create({
          data: {
            email: studentData.email,
            password: defaultPassword,
            firstName: studentData.firstName,
            lastName: studentData.lastName,
            role: Role.STUDENT,
            qrCode: `LF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            age: age,
            gender: gender,
            premiumUser: premiumUser,
            voluntaryExitScore: parseFloat(voluntaryExitScore.toFixed(2))
          }
        });
        console.log(`  ✅ Created: ${studentData.firstName} ${studentData.lastName} (age: ${age}, gender: ${gender}, premium: ${premiumUser}, cooperative: ${(voluntaryExitScore * 100).toFixed(0)}%)`);
      } else {
        // Update existing user with random values if they're missing
        const updateData: any = {};
        
        if (!user.age) {
          updateData.age = getRandomAge();
        }
        if (!user.gender) {
          updateData.gender = getRandomGender();
        }
        // Always randomize premium and voluntaryExitScore for consistency
        updateData.premiumUser = getRandomPremiumStatus();
        updateData.voluntaryExitScore = parseFloat(getRandomVoluntaryExitScore().toFixed(2));
        
        if (Object.keys(updateData).length > 0) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
          console.log(`  🔄 Updated: ${studentData.firstName} ${studentData.lastName} (age: ${user.age}, gender: ${user.gender}, premium: ${user.premiumUser})`);
        } else {
          console.log(`  ℹ️  Exists: ${studentData.firstName} ${studentData.lastName}`);
        }
      }
      
      users.push(user);
    }
    
    console.log(`\n📊 Total users: ${users.length}`);
    
    // Get existing logs count
    const existingLogCount = await prisma.entryExitLog.count();
    console.log(`📊 Current log count: ${existingLogCount}`);
    
    // Generate logs for the past 30 days
    const daysToGenerate = 30;
    const totalSessionsToGenerate = 250; // Each session = 2 logs (entry + exit)
    const logsToCreate: Array<{
      userId: string;
      type: LogType;
      timestamp: Date;
      expirationTime: Date | null;
    }> = [];
    
    console.log(`\n📝 Generating ${totalSessionsToGenerate} sessions (${totalSessionsToGenerate * 2} logs) over ${daysToGenerate} days...`);
    console.log('⏳ This may take a moment...\n');
    
    // Generate entry-exit pairs
    for (let i = 0; i < totalSessionsToGenerate; i++) {
      // Select a random user
      const user = users[Math.floor(Math.random() * users.length)];
      
      // Generate entry timestamp
      const entryTimestamp = getRandomTimestamp(daysToGenerate);
      
      // Generate exit timestamp (between 30 minutes to 8 hours after entry)
      const minutesToAdd = 30 + Math.random() * (8 * 60 - 30); // 30 min to 8 hours
      const exitTimestamp = new Date(entryTimestamp.getTime() + minutesToAdd * 60 * 1000);
      
      // Ensure exit doesn't exceed current time
      const now = new Date();
      if (exitTimestamp > now) {
        exitTimestamp.setTime(now.getTime() - 1000 * 60 * 5); // 5 minutes ago
      }
      
      // Calculate expiration time (1 hour from entry)
      const expirationTime = new Date(entryTimestamp.getTime() + 60 * 60 * 1000);
      
      // Add entry log with expiration time
      logsToCreate.push({
        userId: user.id,
        type: LogType.ENTRY,
        timestamp: entryTimestamp,
        expirationTime: expirationTime
      });
      
      // Add exit log (no expiration time for exits)
      logsToCreate.push({
        userId: user.id,
        type: LogType.EXIT,
        timestamp: exitTimestamp,
        expirationTime: null
      });
      
      // Show progress every 50 sessions
      if ((i + 1) % 50 === 0) {
        console.log(`   Generated ${(i + 1) * 2} logs (${i + 1} sessions)...`);
      }
    }
    
    console.log(`\n✅ Generated ${logsToCreate.length} logs (${totalSessionsToGenerate} entry-exit pairs)`);
    
    // Sort logs by timestamp
    logsToCreate.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Create logs in database
    console.log('\n💾 Saving logs to database...');
    
    // Batch insert for better performance
    const batchSize = 100;
    for (let i = 0; i < logsToCreate.length; i += batchSize) {
      const batch = logsToCreate.slice(i, i + batchSize);
      
      await prisma.entryExitLog.createMany({
        data: batch
      });
      
      if ((i + batchSize) % 100 === 0 || i + batchSize >= logsToCreate.length) {
        console.log(`   Saved ${Math.min(i + batchSize, logsToCreate.length)} logs...`);
      }
    }
    
    // Update system occupancy
    console.log('\n👥 Updating system occupancy...');
    
    const allLogs = await prisma.entryExitLog.findMany({
      orderBy: { timestamp: 'asc' }
    });
    
    const finalOccupancy = calculateOccupancy(allLogs);
    
    const config = await prisma.systemConfig.findFirst();
    if (config) {
      await prisma.systemConfig.update({
        where: { id: config.id },
        data: {
          currentOccupancy: finalOccupancy,
          updatedAt: new Date()
        }
      });
    }
    
    // Display statistics
    const totalLogs = await prisma.entryExitLog.count();
    const entryLogs = await prisma.entryExitLog.count({ where: { type: LogType.ENTRY } });
    const exitLogs = await prisma.entryExitLog.count({ where: { type: LogType.EXIT } });
    
    console.log('\n📊 Population Summary:');
    console.log(`  - Total students: ${users.length}`);
    console.log(`  - Total logs: ${totalLogs}`);
    console.log(`  - Entry logs: ${entryLogs}`);
    console.log(`  - Exit logs: ${exitLogs}`);
    console.log(`  - Entry-Exit balance: ${entryLogs === exitLogs ? '✓ Equal' : '✗ Unequal'}`);
    console.log(`  - Current occupancy: ${finalOccupancy} ${finalOccupancy === 0 ? '✓ (All users exited)' : '✗ (Some users still inside)'}`);
    
    // Show activity by day
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();
    
    console.log('\n📅 Activity by Day (Last 7 Days):');
    for (const day of last30Days.slice(-7)) {
      const dayLogs = allLogs.filter(log => 
        log.timestamp.toISOString().startsWith(day)
      );
      const uniqueUsers = new Set(dayLogs.map(log => log.userId)).size;
      console.log(`  ${day}: ${dayLogs.length} events, ${uniqueUsers} unique users`);
    }
    
    // Update lastActive and frequencyUsed for all users based on populated logs
    console.log('\n🔄 Updating user statistics (lastActive, frequencyUsed)...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const user of users) {
      // Get all exits for this user, sorted by timestamp
      const exits = await prisma.entryExitLog.findMany({
        where: {
          userId: user.id,
          type: LogType.EXIT
        },
        orderBy: { timestamp: 'desc' },
        take: 1
      });
      
      // Calculate frequency (entries in last 30 days)
      const recentEntries = await prisma.entryExitLog.count({
        where: {
          userId: user.id,
          type: LogType.ENTRY,
          timestamp: {
            gte: thirtyDaysAgo
          }
        }
      });
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastActive: exits.length > 0 ? exits[0].timestamp : null,
          frequencyUsed: recentEntries
        }
      });
    }
    console.log(`  ✅ Updated statistics for ${users.length} users`);
    
    console.log('\n🎉 Log population completed successfully!');
    console.log('💡 Tip: Use the reset script to clean up these logs.');
    
  } catch (error) {
    console.error('❌ Error during log population:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  populateLogs()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { populateLogs };
